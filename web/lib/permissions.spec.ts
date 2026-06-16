import assert from "node:assert/strict";
import test from "node:test";
import { MENU_KEYS } from "../domains/menu/constants";
import type { PermissionSummary } from "../domains/menu/types";
import { store } from "../store";
import { clearAuth, setAuthPermissions, setUser } from "../store/authSlice";
import { hasMenuAccess, hasPermission } from "./permissions";

const permissionFor = (key: string): PermissionSummary => ({
  key,
  module: key,
  route: "",
  accessLevel: "WRITE",
  actions: {
    read: true,
    create: true,
    update: true,
    delete: true,
  },
});

const setRole = (role: string, permissions: PermissionSummary[] = []) => {
  store.dispatch(clearAuth());
  store.dispatch(
    setUser({
      id: `${role.toLowerCase()}-user`,
      name: role,
      email: `${role.toLowerCase()}@local.test`,
      role,
      tenantId: "tenant-local",
    })
  );
  store.dispatch(setAuthPermissions(permissions));
};

test("menu permissions expose DB-granted inventory modules to admin roles", () => {
  const inventoryPermissions = [
    MENU_KEYS.INVENTORY_PRODUCTS,
    MENU_KEYS.INVENTORY_UNITS,
    MENU_KEYS.INVENTORY_TAXES,
    MENU_KEYS.INVENTORY_PROMOTIONS,
    MENU_KEYS.INVENTORY_LOCATIONS,
    MENU_KEYS.INVENTORY_LOTS,
  ].map(permissionFor);

  for (const role of ["ADMIN", "SUPER_USER", "SUPER_ADMIN"]) {
    setRole(role, inventoryPermissions);

    assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_PRODUCTS, "READ"), true);
    assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_UNITS, "READ"), true);
    assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_TAXES, "READ"), true);
    assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_LOCATIONS, "READ"), true);
    assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_LOTS, "READ"), true);
    assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_PROMOTIONS, "READ"), true);
  }
});

test("menu permissions keep operational inventory modules hidden for USER", () => {
  setRole("USER");

  assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_PRODUCTS, "READ"), false);
  assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_UNITS, "READ"), false);
  assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_TAXES, "READ"), false);
  assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_LOCATIONS, "READ"), false);
  assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_LOTS, "READ"), false);
  assert.equal(hasMenuAccess(MENU_KEYS.INVENTORY_PROMOTIONS, "READ"), false);
});

test("menu permissions expose finance modules from DB grants", () => {
  const financePermissions = [
    MENU_KEYS.FINANCE,
    MENU_KEYS.FINANCE_CASH_SESSIONS,
    MENU_KEYS.FINANCE_CASH_MOVEMENTS,
  ].map(permissionFor);

  for (const role of ["USER", "ADMIN"]) {
    setRole(role, financePermissions);

    assert.equal(hasMenuAccess(MENU_KEYS.FINANCE, "READ"), true);
    assert.equal(hasMenuAccess(MENU_KEYS.FINANCE_CASH_SESSIONS, "READ"), true);
    assert.equal(hasMenuAccess(MENU_KEYS.FINANCE_CASH_MOVEMENTS, "READ"), true);
    assert.equal(hasMenuAccess(MENU_KEYS.FINANCE_PAYMENT_METHODS, "READ"), false);
  }

  setRole("ADMIN", [
    ...financePermissions,
    permissionFor(MENU_KEYS.FINANCE_CASH_REGISTERS),
  ]);
  assert.equal(hasMenuAccess(MENU_KEYS.FINANCE_CASH_REGISTERS, "READ"), true);

  setRole("SUPER_USER", [
    ...financePermissions,
    permissionFor(MENU_KEYS.FINANCE_CASH_REGISTERS),
    permissionFor(MENU_KEYS.FINANCE_PAYMENT_METHODS),
  ]);
  assert.equal(hasMenuAccess(MENU_KEYS.FINANCE_CASH_REGISTERS, "READ"), true);
  assert.equal(hasMenuAccess(MENU_KEYS.FINANCE_PAYMENT_METHODS, "READ"), true);

  setRole("SUPER_ADMIN");
  assert.equal(hasMenuAccess(MENU_KEYS.FINANCE, "READ"), true);
  assert.equal(hasMenuAccess(MENU_KEYS.FINANCE_CASH_SESSIONS, "READ"), true);
  assert.equal(hasMenuAccess(MENU_KEYS.FINANCE_CASH_MOVEMENTS, "READ"), true);
  assert.equal(hasMenuAccess(MENU_KEYS.FINANCE_CASH_REGISTERS, "READ"), true);
  assert.equal(hasMenuAccess(MENU_KEYS.FINANCE_PAYMENT_METHODS, "READ"), true);
});

test("route permissions allow finance for USER and ADMIN without opening admin modules", () => {
  const financePermission = permissionFor(MENU_KEYS.FINANCE);

  setRole("USER", [financePermission]);
  assert.equal(hasPermission(MENU_KEYS.FINANCE, "read"), true);
  assert.equal(hasPermission(MENU_KEYS.CONFIG_TERMINALS, "read"), false);
  assert.equal(hasPermission(MENU_KEYS.CONFIG_ROLES, "read"), false);

  setRole("ADMIN", [financePermission]);
  assert.equal(hasPermission(MENU_KEYS.FINANCE, "read"), true);
  assert.equal(hasPermission(MENU_KEYS.CONFIG_TERMINALS, "read"), false);
  assert.equal(hasPermission(MENU_KEYS.CONFIG_ROLES, "read"), false);

  setRole("SUPER_USER", [financePermission]);
  assert.equal(hasPermission(MENU_KEYS.FINANCE, "read"), true);
  assert.equal(hasPermission(MENU_KEYS.CONFIG_ROLES, "read"), false);
});

test("roles module is visible only for SUPER_ADMIN", () => {
  const rolesPermission = permissionFor(MENU_KEYS.CONFIG_ROLES);
  const legacyRolesPermission = permissionFor("ROLES_TENANT_ROLES");

  for (const role of ["USER", "ADMIN", "SUPER_USER"]) {
    setRole(role, [rolesPermission, legacyRolesPermission]);

    assert.equal(hasMenuAccess(MENU_KEYS.CONFIG_ROLES, "READ"), false);
    assert.equal(hasPermission(MENU_KEYS.CONFIG_ROLES, "read"), false);
    assert.equal(hasPermission("ROLES_TENANT_ROLES", "read"), false);
  }

  setRole("SUPER_ADMIN");
  assert.equal(hasMenuAccess(MENU_KEYS.CONFIG_ROLES, "READ"), true);
  assert.equal(hasPermission(MENU_KEYS.CONFIG_ROLES, "read"), true);
});

test("menu permissions expose terminals only when DB grants super roles", () => {
  const terminalPermission = permissionFor(MENU_KEYS.CONFIG_TERMINALS);

  setRole("ADMIN", [terminalPermission]);
  assert.equal(hasMenuAccess(MENU_KEYS.CONFIG_TERMINALS, "READ"), false);

  setRole("SUPER_USER", [terminalPermission]);
  assert.equal(hasMenuAccess(MENU_KEYS.CONFIG_TERMINALS, "READ"), true);

  setRole("SUPER_ADMIN", [terminalPermission]);
  assert.equal(hasMenuAccess(MENU_KEYS.CONFIG_TERMINALS, "READ"), true);
});

test("route permissions allow terminal module only for super roles with DB grant", () => {
  const terminalPermission = permissionFor(MENU_KEYS.CONFIG_TERMINALS);

  setRole("ADMIN", [terminalPermission]);
  assert.equal(hasPermission(MENU_KEYS.CONFIG_TERMINALS, "read"), false);

  setRole("USER");
  assert.equal(hasPermission(MENU_KEYS.CONFIG_TERMINALS, "read"), false);

  setRole("SUPER_USER");
  assert.equal(hasPermission(MENU_KEYS.CONFIG_TERMINALS, "read"), true);

  setRole("SUPER_ADMIN");
  assert.equal(hasPermission(MENU_KEYS.CONFIG_TERMINALS, "read"), true);
});
