import assert from "node:assert/strict";
import test from "node:test";
import { MENU_KEYS } from "../constants/menu-keys";
import { PermissionsGuard } from "./permissions.guard";

const buildContext = (user: { id?: string; tenantId?: string; roles?: string[] }) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as any;

test("PermissionsGuard: allows READ when permission is READ", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CUSTOMERS", level: "READ" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "CUSTOMERS",
          {
            key: "CUSTOMERS",
            module: "customers",
            route: "/customers",
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
    getAllAndOverride: () => ({ menuKey: "CUSTOMERS", level: "WRITE" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "CUSTOMERS",
          {
            key: "CUSTOMERS",
            module: "customers",
            route: "/customers",
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

test("PermissionsGuard: allows declared operational role without DB permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: "CUSTOMERS",
      level: "WRITE",
      operationalRoles: ["USER", "ADMIN", "SUPER_USER"],
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => {
      throw new Error("should not fetch permissions for declared operational role");
    },
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(
    buildContext({ id: "user", tenantId: "tenant", roles: ["USER"] })
  );
  assert.equal(allowed, true);
});

test("PermissionsGuard: blocks USER catalog READ when endpoint did not opt in", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: MENU_KEYS.INVENTORY_PRODUCTS,
      level: "READ",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => new Map(),
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  await assert.rejects(
    () =>
      guard.canActivate(
        buildContext({ id: "user", tenantId: "tenant", roles: ["USER"] })
      ),
    /Permisos insuficientes/
  );
});

test("PermissionsGuard: allows WRITE when permission is WRITE", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CUSTOMERS", level: "WRITE" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "CUSTOMERS",
          {
            key: "CUSTOMERS",
            module: "customers",
            route: "/customers",
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

test("PermissionsGuard: allows when any declared menu key matches", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: ["ELECTRONIC_INVOICING_CUSTOMERS", "POS"],
      level: "WRITE",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "POS",
          {
            key: "POS",
            module: "pos",
            route: "/pos",
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

test("PermissionsGuard: blocks CONFIG_ROLES for non-SUPER_ADMIN even with DB grant", async () => {
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
  for (const role of ["SUPER_USER", "ADMIN", "USER"]) {
    await assert.rejects(
      () =>
        guard.canActivate(
          buildContext({ id: "user", tenantId: "tenant", roles: [role] })
        ),
      /Permisos insuficientes/
    );
  }
});

test("PermissionsGuard: allows SUPER_ADMIN CONFIG_ROLES", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CONFIG_ROLES", level: "READ" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => {
      throw new Error("should not fetch permissions for SUPER_ADMIN");
    },
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(
    buildContext({ id: "user", tenantId: "tenant", roles: ["SUPER_ADMIN"] })
  );
  assert.equal(allowed, true);
});

test("PermissionsGuard: blocks legacy ROLES_TENANT_ROLES for SUPER_USER", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "ROLES_TENANT_ROLES", level: "READ" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => new Map(),
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  await assert.rejects(
    () =>
      guard.canActivate(
        buildContext({ id: "user", tenantId: "tenant", roles: ["SUPER_USER"] })
      ),
    /Permisos insuficientes/
  );
});

test("PermissionsGuard: blocks SUPER_USER CONFIG_ROLES shortcut", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: "CONFIG_ROLES", level: "READ" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => new Map(),
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  await assert.rejects(
    () =>
      guard.canActivate(
        buildContext({ id: "user", tenantId: "tenant", roles: ["SUPER_USER"] } as any)
      ),
    /Permisos insuficientes/
  );
});

test("PermissionsGuard: allows SUPER_USER to read CONFIG_TERMINALS", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "READ" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => {
      throw new Error("should not fetch permissions for SUPER_USER terminal shortcut");
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

test("PermissionsGuard: blocks ADMIN CONFIG_TERMINALS without permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "READ" }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => new Map(),
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  await assert.rejects(
    () =>
      guard.canActivate(
        buildContext({ id: "user", tenantId: "tenant", roles: ["ADMIN"] })
      ),
    /Permisos insuficientes/
  );
});

test("PermissionsGuard: allows ADMIN operational catalog WRITE without DB permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: MENU_KEYS.INVENTORY_PRODUCTS,
      level: "WRITE",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => {
      throw new Error("should not fetch permissions for ADMIN operational shortcut");
    },
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(
    buildContext({ id: "user", tenantId: "tenant", roles: ["ADMIN"] })
  );
  assert.equal(allowed, true);
});

test("PermissionsGuard: allows ADMIN generic inventory WRITE without DB permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: "INVENTORY",
      level: "WRITE",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => {
      throw new Error("should not fetch permissions for ADMIN inventory shortcut");
    },
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(
    buildContext({ id: "user", tenantId: "tenant", roles: ["ADMIN"] })
  );
  assert.equal(allowed, true);
});

test("PermissionsGuard: blocks USER generic inventory WRITE without permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: "INVENTORY",
      level: "WRITE",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => new Map(),
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  await assert.rejects(
    () =>
      guard.canActivate(
        buildContext({ id: "user", tenantId: "tenant", roles: ["USER"] })
      ),
    /Permisos insuficientes/
  );
});

test("PermissionsGuard: allows ADMIN electronic invoicing suppliers WRITE through inventory suppliers alias", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS,
      level: "WRITE",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => {
      throw new Error("should not fetch permissions for ADMIN suppliers alias shortcut");
    },
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(
    buildContext({ id: "user", tenantId: "tenant", roles: ["ADMIN"] })
  );
  assert.equal(allowed, true);
});

test("PermissionsGuard: blocks USER electronic invoicing suppliers WRITE without permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS,
      level: "WRITE",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => new Map(),
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  await assert.rejects(
    () =>
      guard.canActivate(
        buildContext({ id: "user", tenantId: "tenant", roles: ["USER"] })
      ),
    /Permisos insuficientes/
  );
});

test("PermissionsGuard: allows SUPER_USER operational promotions WRITE without DB permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: MENU_KEYS.INVENTORY_PROMOTIONS,
      level: "WRITE",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => {
      throw new Error("should not fetch permissions for SUPER_USER operational shortcut");
    },
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(
    buildContext({ id: "user", tenantId: "tenant", roles: ["SUPER_USER"] })
  );
  assert.equal(allowed, true);
});

test("PermissionsGuard: blocks USER without explicit operational promotion permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: MENU_KEYS.INVENTORY_PROMOTIONS,
      level: "WRITE",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () => new Map(),
    findPermission: () => undefined,
    isAccessAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  await assert.rejects(
    () =>
      guard.canActivate(
        buildContext({ id: "user", tenantId: "tenant", roles: ["USER"] })
      ),
    /Permisos insuficientes/
  );
});

test("PermissionsGuard: allows explicit action permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: "INVENTORY_PURCHASES",
      level: "WRITE",
      action: "cancel",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "INVENTORY_PURCHASES",
          {
            key: "INVENTORY_PURCHASES",
            accessLevel: "WRITE",
            actions: { cancel: true },
          },
        ],
      ]),
    findPermission: (permissions: Map<string, unknown>, menuKey: string) =>
      permissions.get(menuKey),
    isActionAllowed: (permission: any, required: any, action: string) =>
      required === "WRITE" &&
      permission?.accessLevel === "WRITE" &&
      permission?.actions?.[action] === true,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(buildContext({ id: "user", tenantId: "tenant" }));
  assert.equal(allowed, true);
});

test("PermissionsGuard: blocks missing explicit action permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: "INVENTORY_PURCHASES",
      level: "WRITE",
      action: "cancel",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "INVENTORY_PURCHASES",
          {
            key: "INVENTORY_PURCHASES",
            accessLevel: "WRITE",
            actions: {},
          },
        ],
      ]),
    findPermission: (permissions: Map<string, unknown>, menuKey: string) =>
      permissions.get(menuKey),
    isActionAllowed: () => false,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  await assert.rejects(
    () => guard.canActivate(buildContext({ id: "user", tenantId: "tenant" })),
    /Permisos insuficientes/
  );
});

test("PermissionsGuard: allows settle partial purchase action permission", async () => {
  const reflector = {
    getAllAndOverride: () => ({
      menuKey: "INVENTORY_PURCHASES",
      level: "WRITE",
      action: "settle_partial",
    }),
  } as any;
  const accessControlService = {
    getPermissionsForRequest: async () =>
      new Map([
        [
          "INVENTORY_PURCHASES",
          {
            key: "INVENTORY_PURCHASES",
            accessLevel: "WRITE",
            actions: { settle_partial: true },
          },
        ],
      ]),
    findPermission: (permissions: Map<string, unknown>, menuKey: string) =>
      permissions.get(menuKey),
    isActionAllowed: (permission: any, required: any, action: string) =>
      required === "WRITE" &&
      permission?.accessLevel === "WRITE" &&
      permission?.actions?.[action] === true,
  } as any;

  const guard = new PermissionsGuard(reflector, accessControlService);
  const allowed = await guard.canActivate(buildContext({ id: "user", tenantId: "tenant" }));
  assert.equal(allowed, true);
});
