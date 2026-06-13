import assert from "node:assert/strict";
import test from "node:test";
import { RolesController } from "./roles.controller";

const roles = [
  {
    id: "role-super-admin",
    nombre: "SUPER_ADMIN",
    descripcion: null,
    created_at: "2026-06-12T00:00:00.000Z",
  },
  {
    id: "role-super-user",
    nombre: "SUPER_USER",
    descripcion: null,
    created_at: "2026-06-12T00:00:00.000Z",
  },
  {
    id: "role-admin",
    nombre: "ADMIN",
    descripcion: null,
    created_at: "2026-06-12T00:00:00.000Z",
  },
  {
    id: "role-user",
    nombre: "USER",
    descripcion: null,
    created_at: "2026-06-12T00:00:00.000Z",
  },
];

test("RolesController: SUPER_USER list excludes higher roles", async () => {
  const controller = new RolesController({
    listRoles: async () => roles,
  } as never);

  const result = await controller.list({
    user: {
      id: "user-1",
      tenantId: "tenant-1",
      roles: ["SUPER_USER"],
    },
  } as never);

  assert.deepEqual(
    result.map((role) => role.nombre),
    ["ADMIN", "USER"]
  );
});

test("RolesController: SUPER_ADMIN list keeps all roles", async () => {
  const controller = new RolesController({
    listRoles: async () => roles,
  } as never);

  const result = await controller.list({
    user: {
      id: "user-1",
      tenantId: "tenant-1",
      roles: ["SUPER_ADMIN"],
    },
  } as never);

  assert.deepEqual(
    result.map((role) => role.nombre),
    ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]
  );
});
