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
    { rows: [{ id: "role-1" }] },
    { rows: [{ id: "branch-1" }] },
    { rows: [{ id: "persona-1" }] },
    { rows: [{ id: "user-1" }] },
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
    { roles: ["SUPER_ADMIN"], tenantId: "tenant-1" }
  );

  assert.equal(result.id, "user-1");
  assert.ok(queries.some((query) => query.startsWith("BEGIN")));
  assert.ok(queries.some((query) => query.startsWith("COMMIT")));
});
