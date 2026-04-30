import assert from "node:assert/strict";
import test from "node:test";
import { PermissionsGuard } from "./permissions.guard";

const buildContext = (user: { id?: string; tenantId?: string }) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as any;

test("PermissionsGuard: allows READ when permission is READ", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CONFIG_ROLES", level: "READ" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "CONFIG_ROLES",
          {
            key: "CONFIG_ROLES",
            module: "roles",
            route: "/roles",
            accessLevel: "READ",
            actions: {},
          },
        ],
      ]),
    findPermission: (permissions: Map<string, unknown>, menuKey: string) =>
      permissions.get(menuKey),
    isAccessAllowed: (permission: any, required: any) => {
      if (required === "READ") {
        return permission?.accessLevel === "READ" || permission?.accessLevel === "WRITE";
      }
      return permission?.accessLevel === "WRITE";
    },
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(buildContext({ id: "user", tenantId: "tenant" }));
  assert.equal(allowed, true);
});

test("PermissionsGuard: blocks WRITE when permission is READ", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CONFIG_ROLES", level: "WRITE" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "CONFIG_ROLES",
          {
            key: "CONFIG_ROLES",
            module: "roles",
            route: "/roles",
            accessLevel: "READ",
            actions: {},
          },
        ],
      ]),
    findPermission: (permissions: Map<string, unknown>, menuKey: string) =>
      permissions.get(menuKey),
    isAccessAllowed: (permission: any, required: any) => {
      if (required === "READ") {
        return permission?.accessLevel === "READ" || permission?.accessLevel === "WRITE";
      }
      return permission?.accessLevel === "WRITE";
    },
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  await assert.rejects(
    () => guard.canActivate(buildContext({ id: "user", tenantId: "tenant" })),
    /Permisos insuficientes/
  );
});

test("PermissionsGuard: allows WRITE when permission is WRITE", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CONFIG_ROLES", level: "WRITE" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "CONFIG_ROLES",
          {
            key: "CONFIG_ROLES",
            module: "roles",
            route: "/roles",
            accessLevel: "WRITE",
            actions: {},
          },
        ],
      ]),
    findPermission: (permissions: Map<string, unknown>, menuKey: string) =>
      permissions.get(menuKey),
    isAccessAllowed: (permission: any, required: any) => {
      if (required === "READ") {
        return permission?.accessLevel === "READ" || permission?.accessLevel === "WRITE";
      }
      return permission?.accessLevel === "WRITE";
    },
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(buildContext({ id: "user", tenantId: "tenant" }));
  assert.equal(allowed, true);
});

test("PermissionsGuard: resolves legacy key alias from service", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CONFIG_ROLES", level: "READ" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "ROLES_TENANT_ROLES",
          {
            key: "ROLES_TENANT_ROLES",
            module: "roles",
            route: "/roles",
            accessLevel: "READ",
            actions: {},
          },
        ],
      ]),
    findPermission: (permissions: Map<string, any>, menuKey: string) => {
      if (menuKey === "CONFIG_ROLES") {
        return permissions.get("ROLES_TENANT_ROLES");
      }
      return permissions.get(menuKey);
    },
    isAccessAllowed: (permission: any, required: any) => {
      if (required === "READ") {
        return permission?.accessLevel === "READ" || permission?.accessLevel === "WRITE";
      }
      return permission?.accessLevel === "WRITE";
    },
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(buildContext({ id: "user", tenantId: "tenant" }));
  assert.equal(allowed, true);
});

test("PermissionsGuard: allows SUPER_USER to read CONFIG_ROLES", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CONFIG_ROLES", level: "READ" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => {
      throw new Error("should not fetch permissions for SUPER_USER role shortcut");
    },
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(
    buildContext({ id: "user", tenantId: "tenant", roles: ["SUPER_USER"] } as any)
  );
  assert.equal(allowed, true);
});
