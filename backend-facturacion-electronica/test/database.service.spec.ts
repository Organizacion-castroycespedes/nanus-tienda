import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseService } from "../src/modules/database/database.service";

class FakeClient {
  public readonly queries: string[] = [];
  public released = false;
  public readonly results: Record<string, unknown>[] = [];

  constructor(private readonly transactionRunner?: () => void) {}

  async query(text: string) {
    this.queries.push(text);

    if (text === "COMMIT" && this.transactionRunner) {
      this.transactionRunner();
    }

    return { rows: [], rowCount: 0 };
  }

  release() {
    this.released = true;
  }
}

test("database service wraps work in a transaction", async () => {
  let connectCount = 0;
  const client = new FakeClient();
  const pool = {
    async connect() {
      connectCount += 1;
      return client as never;
    },
    async end() {
      return undefined;
    },
  };

  const service = new DatabaseService({
    config: {
      host: "localhost",
      port: 5432,
      database: "billing_db",
      username: "billing_user",
      password: "secret",
      ssl: false,
      logging: false,
      poolMax: 10,
    },
    poolFactory: () => pool,
  });

  const result = await service.transaction(async (transactionClient) => {
    await transactionClient.query("SELECT 1");
    return "done";
  });

  assert.equal(result, "done");
  assert.equal(connectCount, 1);
  assert.deepEqual(client.queries, ["BEGIN", "SELECT 1", "COMMIT"]);
  assert.equal(client.released, true);
});

test("database service rolls back on failure", async () => {
  const client = new FakeClient();
  const pool = {
    async connect() {
      return client as never;
    },
    async end() {
      return undefined;
    },
  };

  const service = new DatabaseService({
    config: {
      host: "localhost",
      port: 5432,
      database: "billing_db",
      username: "billing_user",
      password: "secret",
      ssl: false,
      logging: false,
      poolMax: 10,
    },
    poolFactory: () => pool,
  });

  await assert.rejects(
    service.transaction(async () => {
      throw new Error("boom");
    }),
    /boom/
  );

  assert.deepEqual(client.queries, ["BEGIN", "ROLLBACK"]);
  assert.equal(client.released, true);
});

test("database service closes pool on shutdown", async () => {
  let endCount = 0;
  const client = new FakeClient();
  const pool = {
    async connect() {
      return client as never;
    },
    async end() {
      endCount += 1;
    },
  };

  const service = new DatabaseService({
    config: {
      host: "localhost",
      port: 5432,
      database: "billing_db",
      username: "billing_user",
      password: "secret",
      ssl: false,
      logging: false,
      poolMax: 10,
    },
    poolFactory: () => pool,
  });

  await service.query("SELECT 1");
  await service.close();
  await service.onModuleDestroy();
  await service.onApplicationShutdown();

  assert.equal(endCount, 1);
});
