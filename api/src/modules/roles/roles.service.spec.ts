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

test("RolesService: SUPER_USER query excludes SUPER_ADMIN", async () => {
  let params: unknown[] | undefined;
  const db = {
    query: async (_text: string, queryParams: unknown[]) => {
      params = queryParams;
      return {
        rows: [
          { id: "role-user", nombre: "USER" },
          { id: "role-admin", nombre: "ADMIN" },
        ],
      };
    },
  };

  const service = new RolesService(db as never);
  const result = await service.listRoles({
    roles: ["SUPER_USER"],
    userId: "user-1",
    tenantId: "tenant-1",
  });

  assert.deepEqual(result.map((role) => role.nombre), ["USER", "ADMIN"]);
  assert.deepEqual(params, [false, "SUPER_ADMIN", "tenant-1"]);
});

test("RolesService: listRoleUsers scopes by tenant for non-SUPER_ADMIN", async () => {
  let capturedParams: unknown[] | undefined;
  const db = {
    query: async (_text: string, queryParams: unknown[]) => {
      capturedParams = queryParams;
      return {
        rows: [
          {
            id: "u-1",
            email: "cajero@demo.com",
            estado: "ACTIVE",
            created_at: "2026-06-12T00:00:00.000Z",
            tenant_id: "tenant-1",
            tenant_nombre: "Tenant 1",
            tenant_slug: "t1",
            persona_id: "p-1",
            nombres: "Juan",
            apellidos: "Pérez",
            documento_tipo: "CC",
            documento_numero: "12345",
            cargo_nombre: "Cajero",
            telefono: "555-1234",
            email_personal: "juan@demo.com",
            branch_id: "b-1",
            branch_nombre: "Sucursal Norte",
          },
        ],
      };
    },
  };

  const service = new RolesService(db as never);
  const result = await service.listRoleUsers("role-1", {
    roles: ["SUPER_USER"],
    userId: "user-1",
    tenantId: "tenant-1",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].email, "cajero@demo.com");
  assert.equal(result[0].tenant.nombre, "Tenant 1");
  assert.equal(result[0].persona?.nombres, "Juan");
  assert.deepEqual(capturedParams, [
    "role-1",
    false,
    "SUPER_ADMIN",
    "tenant-1",
    "tenant-1",
  ]);
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
