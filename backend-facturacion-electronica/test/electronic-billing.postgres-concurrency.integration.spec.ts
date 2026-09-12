import assert from "node:assert/strict";
import test from "node:test";
import { Pool, type PoolClient } from "pg";
import { DatabaseService } from "../src/modules/database/database.service";
import { ElectronicBillingProcessingService } from "../src/modules/electronic-billing/services/electronic-billing-processing.service";

const host = process.env.PGHOST ?? "";
const port = Number(process.env.PGPORT ?? "0");
const database = process.env.PGDATABASE ?? "";

const isIsolatedLocalDatabase = host === "localhost" && port === 55432 && database === "manus_billing_concurrency_test";
const integrationTest = isIsolatedLocalDatabase ? test : test.skip;

const withPool = async <T>(runner: (pool: Pool) => Promise<T>) => {
  if (!isIsolatedLocalDatabase) {
    throw new Error("PostgreSQL concurrency test requires the disposable local test database");
  }

  const pool = new Pool({
    host,
    port,
    database,
    user: process.env.PGUSER ?? "postgres",
    password: process.env.PGPASSWORD,
    max: 4,
  });
  try {
    return await runner(pool);
  } finally {
    await pool.end();
  }
};

const acquire = async (client: PoolClient, key: string) => {
  await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [key]);
};

const release = async (client: PoolClient, key: string) => {
  await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [key]);
};

integrationTest("PostgreSQL serializes the same document across two connections", async () => {
  await withPool(async (pool) => {
    const first = await pool.connect();
    const second = await pool.connect();
    const key = "tenant-a:document-a";
    let secondAcquired = false;
    try {
      await acquire(first, key);
      const waiting = acquire(second, key).then(() => {
        secondAcquired = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(secondAcquired, false);
      await release(first, key);
      await waiting;
      assert.equal(secondAcquired, true);
      await release(second, key);
    } finally {
      first.release(true);
      second.release(true);
    }
  });
});

integrationTest("processing service lock serializes repeated competing executions", async () => {
  await withPool(async () => {
    const databaseService = new DatabaseService({
      config: {
        host,
        port,
        database,
        username: process.env.PGUSER ?? "postgres",
        password: process.env.PGPASSWORD ?? "",
        ssl: false,
        logging: false,
        poolMax: 4,
      },
      poolFactory: () => new Pool({ host, port, database, user: process.env.PGUSER ?? "postgres", password: process.env.PGPASSWORD, max: 4 }),
    });
    const service = Object.create(ElectronicBillingProcessingService.prototype) as Record<string, unknown>;
    service.db = databaseService;
    let maximumActive = 0;
    let active = 0;

    try {
      for (let iteration = 0; iteration < 10; iteration += 1) {
        await Promise.all([
          (service.withDocumentProcessingLock as (...args: unknown[]) => Promise<void>)("tenant-a", "document-a", async () => {
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active -= 1;
          }),
          (service.withDocumentProcessingLock as (...args: unknown[]) => Promise<void>)("tenant-a", "document-a", async () => {
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active -= 1;
          }),
        ]);
      }
    } finally {
      await databaseService.close();
    }

    assert.equal(maximumActive, 1);
  });
});

integrationTest("PostgreSQL allows different documents and tenants to proceed in parallel", async () => {
  await withPool(async (pool) => {
    const clients = await Promise.all([pool.connect(), pool.connect(), pool.connect(), pool.connect()]);
    const keys = ["tenant-a:document-a", "tenant-a:document-b", "tenant-b:document-a", "tenant-b:document-b"];
    try {
      await Promise.all(clients.map((client, index) => acquire(client, keys[index])));
      await Promise.all(clients.map((client, index) => release(client, keys[index])));
    } finally {
      clients.forEach((client) => client.release(true));
    }
  });
});

integrationTest("connection termination releases the session advisory lock", async () => {
  await withPool(async (pool) => {
    const first = await pool.connect();
    const second = await pool.connect();
    const key = "tenant-a:document-drop";
    try {
      await acquire(first, key);
      first.release(true);
      await acquire(second, key);
      await release(second, key);
    } finally {
      second.release(true);
    }
  });
});

integrationTest("stale lease claim allows one worker after the lease expires", async () => {
  await withPool(async (pool) => {
    const setup = await pool.connect();
    const table = `phase54_stale_${Date.now()}`;
    try {
      await setup.query(`CREATE TABLE ${table} (id text PRIMARY KEY, status text NOT NULL, lease_at timestamptz NOT NULL)`);
      await setup.query(`INSERT INTO ${table} (id, status, lease_at) VALUES ('document-a', 'PROCESSING', NOW() - INTERVAL '1 second')`);
    } finally {
      setup.release();
    }

    const clients = await Promise.all([pool.connect(), pool.connect()]);
    const claims = await Promise.all(clients.map(async (client) => {
      try {
        await client.query("BEGIN");
        const result = await client.query<{ id: string }>(
          `WITH candidate AS (
             SELECT id FROM ${table}
             WHERE status = 'PROCESSING' AND lease_at <= NOW()
             FOR UPDATE SKIP LOCKED LIMIT 1
           )
           UPDATE ${table} AS document
           SET lease_at = NOW() + INTERVAL '5 minutes'
           FROM candidate
           WHERE document.id = candidate.id
           RETURNING document.id`,
        );
        await client.query("COMMIT");
        return result.rowCount;
      } finally {
        client.release(true);
      }
    }));

    const claimCount = claims.reduce((total, count) => total + (count ?? 0), 0);
    assert.equal(claimCount, 1);
    const cleanup = await pool.connect();
    try {
      await cleanup.query(`DROP TABLE ${table}`);
    } finally {
      cleanup.release();
    }
  });
});
