import assert from "node:assert/strict";
import test from "node:test";
import { RolesService } from "./roles.service";

class FakeDatabaseService {
  constructor(
    private readonly client: {
      query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
      release: () => void;
    }
  ) {}

  async getClient() {
    return this.client;
  }

  async query() {
    return { rows: [] };
  }
}

test("RolesService: createRole persists tenant assignments", async () => {
  const queries: string[] = [];
  const results = [
    { rows: [{ id: "role-1", nombre: "ADMIN", descripcion: "Desc", created_at: "2026-04-30T00:00:00.000Z" }] },
  ];

  const client = {
    query: async (text: string) => {
      const trimmed = text.trim();
      queries.push(trimmed);
      if (
        trimmed.startsWith("BEGIN") ||
        trimmed.startsWith("COMMIT") ||
        trimmed.startsWith("ROLLBACK") ||
        trimmed.startsWith("INSERT INTO user_roles")
      ) {
        return { rows: [] };
      }
      const next = results.shift();
      if (!next) {
        throw new Error("Missing fake result");
      }
      return next;
    },
    release: () => undefined,
  };

  const service = new RolesService(new FakeDatabaseService(client) as never);

  const result = await service.createRole(
    {
      nombre: "ADMIN",
      descripcion: "Desc",
      tenantIds: ["tenant-1"],
    },
    { roles: ["SUPER_ADMIN"], userId: "user-1", tenantId: "tenant-1" }
  );

  assert.deepEqual(result.tenant_ids, ["tenant-1"]);
  assert.ok(queries.some((query) => query.startsWith("INSERT INTO user_roles")));
});

test("RolesService: updateRole restores tenant assignments", async () => {
  const queries: string[] = [];
  const results = [
    { rows: [{ id: "role-1", nombre: "ADMIN", descripcion: "Desc", created_at: "2026-04-30T00:00:00.000Z" }] },
    {
      rows: [
        {
          id: "role-1",
          nombre: "ADMIN",
          descripcion: "Desc",
          created_at: "2026-04-30T00:00:00.000Z",
          tenant_ids: ["tenant-1"],
        },
      ],
    },
  ];

  const client = {
    query: async (text: string) => {
      const trimmed = text.trim();
      queries.push(trimmed);
      if (
        trimmed.startsWith("BEGIN") ||
        trimmed.startsWith("COMMIT") ||
        trimmed.startsWith("ROLLBACK") ||
        trimmed.startsWith("DELETE FROM user_roles") ||
        trimmed.startsWith("INSERT INTO user_roles")
      ) {
        return { rows: [] };
      }
      const next = results.shift();
      if (!next) {
        throw new Error("Missing fake result");
      }
      return next;
    },
    release: () => undefined,
  };

  const service = new RolesService(new FakeDatabaseService(client) as never);

  const result = await service.updateRole(
    "role-1",
    {
      tenantIds: ["tenant-1"],
    },
    { roles: ["SUPER_ADMIN"], userId: "user-1", tenantId: "tenant-1" }
  );

  assert.deepEqual(result?.tenant_ids, ["tenant-1"]);
  assert.ok(queries.some((query) => query.startsWith("INSERT INTO user_roles")));
});
