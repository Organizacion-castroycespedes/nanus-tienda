import assert from "node:assert/strict";
import test from "node:test";
import { UsersService } from "./users.service";

class FakeDatabaseService {
  constructor(private readonly client: { query: Function; release: Function }) {}

  async getClient() {
    return this.client;
  }

  async query() {
    return { rows: [] };
  }
}

test("UsersService: admin cannot query other tenant", async () => {
  const client = {
    query: async () => ({ rows: [] }),
    release: () => undefined,
  };
  const service = new UsersService(new FakeDatabaseService(client) as never);

  await assert.rejects(
    () =>
      service.listUsers(
        { tenantId: "tenant-2" },
        { roles: ["ADMIN"], tenantId: "tenant-1" }
      ),
    /No autorizado/
  );
});

test("UsersService: createUser uses transaction and returns user", async () => {
  const queries: string[] = [];
  const results = [
    { rows: [] },
    { rows: [{ id: "role-1", nombre: "ADMIN" }] },
    { rows: [{ id: "branch-1" }] },
    { rows: [{ id: "persona-1" }] },
    { rows: [{ id: "user-1" }] },
    { rows: [] },
    { rows: [] },
    {
      rows: [
        {
          id: "user-1",
          email: "test@example.com",
          estado: "ACTIVE",
          tenant_id: "tenant-1",
          tenant_nombre: "Tenant",
          persona_id: "persona-1",
          nombres: "Ana",
          apellidos: "Perez",
          documento_tipo: "CC",
          documento_numero: "123",
          telefono: null,
          direccion: null,
          email_personal: null,
          cargo_nombre: "Analista",
          cargo_descripcion: null,
          funciones_descripcion: null,
          role_id: "role-1",
          role_nombre: "ADMIN",
          branch_id: "branch-1",
          branch_nombre: "Principal",
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
        trimmed.startsWith("ROLLBACK")
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

  const service = new UsersService(new FakeDatabaseService(client) as never);

  const result = await service.createUser(
    {
      email: "test@example.com",
      password: "Password123",
      estado: "ACTIVE",
      tenantId: "tenant-1",
      tenantBranchId: "branch-1",
      roleId: "role-1",
      persona: {
        nombres: "Ana",
        apellidos: "Perez",
        documentoTipo: "CC",
        documentoNumero: "123",
        cargoNombre: "Analista",
      },
    },
    { roles: ["SUPER_USER"], tenantId: "tenant-1" }
  );

  assert.equal(result.id, "user-1");
  assert.ok(queries.some((query) => query.startsWith("BEGIN")));
  assert.ok(queries.some((query) => query.startsWith("COMMIT")));
});

test("UsersService: SUPER_USER cannot create a SUPER_ADMIN", async () => {
  const queries: string[] = [];
  const client = {
    query: async (text: string) => {
      const trimmed = text.trim();
      queries.push(trimmed);
      if (trimmed.startsWith("BEGIN") || trimmed.startsWith("ROLLBACK")) {
        return { rows: [] };
      }
      if (trimmed.startsWith("SELECT id FROM users")) {
        return { rows: [] };
      }
      return { rows: [{ id: "role-super-admin", nombre: "SUPER_ADMIN" }] };
    },
    release: () => undefined,
  };
  const service = new UsersService(new FakeDatabaseService(client) as never);

  await assert.rejects(
    () =>
      service.createUser(
        {
          email: "blocked@example.com",
          password: "Password123",
          tenantBranchId: "branch-1",
          roleId: "role-super-admin",
          persona: {
            nombres: "Ana",
            apellidos: "Perez",
            documentoTipo: "CC",
            documentoNumero: "123",
            cargoNombre: "Analista",
          },
        },
        { roles: ["SUPER_USER"], tenantId: "tenant-1" }
      ),
    /No autorizado para asignar este rol/
  );
  assert.ok(queries.some((query) => query.startsWith("ROLLBACK")));
});

test("UsersService: SUPER_USER cannot edit a SUPER_ADMIN account", async () => {
  const client = {
    query: async (text: string) => {
      if (text.trim().startsWith("BEGIN")) return { rows: [] };
      if (text.includes("roles.nombre = $3")) return { rows: [{ exists: 1 }] };
      return {
        rows: [
          {
            id: "user-super-admin",
            tenant_id: "tenant-1",
            role_nombre: "ADMIN",
          },
        ],
      };
    },
    release: () => undefined,
  };
  const service = new UsersService(new FakeDatabaseService(client) as never);

  await assert.rejects(
    () =>
      service.updateUser(
        "user-super-admin",
        { roleId: "role-user" },
        { roles: ["SUPER_USER"], tenantId: "tenant-1" }
      ),
    /No autorizado/
  );
});

test("UsersService: SUPER_USER can edit a permitted role", async () => {
  const current = {
    id: "user-1",
    email: "user@example.com",
    estado: "ACTIVE",
    tenant_id: "tenant-1",
    tenant_nombre: "Tenant",
    persona_id: null,
    role_nombre: "ADMIN",
    role_id: "role-admin",
  };
  const client = {
    query: async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.startsWith("BEGIN")) return { rows: [] };
      if (trimmed.includes("roles.nombre = $3")) return { rows: [] };
      if (trimmed.startsWith("SELECT id, nombre FROM roles")) {
        return { rows: [{ id: "role-user", nombre: "USER" }] };
      }
      if (
        trimmed.startsWith("DELETE FROM user_roles") ||
        trimmed.startsWith("INSERT INTO user_roles") ||
        trimmed.startsWith("COMMIT")
      ) {
        return { rows: [] };
      }
      return { rows: [current] };
    },
    release: () => undefined,
  };
  const service = new UsersService(new FakeDatabaseService(client) as never);

  const result = await service.updateUser(
    "user-1",
    { roleId: "role-user" },
    { roles: ["SUPER_USER"], tenantId: "tenant-1" }
  );

  assert.equal(result.id, "user-1");
});
