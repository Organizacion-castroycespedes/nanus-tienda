import assert from "node:assert/strict";
import test from "node:test";
import { MENU_KEYS } from "../domains/menu/constants";
import {
  canAccessInfrastructureAdminRoute,
  getRoutePermissionRequirement,
} from "./route-permissions";

test("infrastructure administration routes are SUPER_ADMIN only", () => {
  assert.equal(
    canAccessInfrastructureAdminRoute(
      "/00000000-0000-0000-0000-000000000001/config/terminals",
      "SUPER_ADMIN"
    ),
    true
  );
  assert.equal(
    canAccessInfrastructureAdminRoute(
      "/00000000-0000-0000-0000-000000000001/config/terminals",
      "SUPER_USER"
    ),
    false
  );
  assert.equal(
    canAccessInfrastructureAdminRoute(
      "/00000000-0000-0000-0000-000000000001/config/terminals",
      "USER"
    ),
    false
  );
  assert.equal(
    canAccessInfrastructureAdminRoute(
      "/00000000-0000-0000-0000-000000000001/admin/peripherals",
      "USER"
    ),
    false
  );
  assert.equal(
    canAccessInfrastructureAdminRoute(
      "/00000000-0000-0000-0000-000000000001/admin/peripherals",
      "SUPER_USER"
    ),
    false
  );
});

test("terminal route uses canonical CONFIG_TERMINALS permission", () => {
  assert.deepEqual(
    getRoutePermissionRequirement(
      "/00000000-0000-0000-0000-000000000001/config/terminals"
    ),
    {
      module: MENU_KEYS.CONFIG_TERMINALS,
      action: "read",
    }
  );
});

test("legacy terminales path is not a protected canonical route", () => {
  assert.equal(
    getRoutePermissionRequirement(
      "/00000000-0000-0000-0000-000000000001/terminales"
    ),
    null
  );
});

test("roles route uses canonical CONFIG_ROLES permission", () => {
  assert.deepEqual(
    getRoutePermissionRequirement(
      "/00000000-0000-0000-0000-000000000001/roles"
    ),
    {
      module: MENU_KEYS.CONFIG_ROLES,
      action: "read",
    }
  );
});

test("inventory admin route uses canonical INVENTORY permission", () => {
  assert.deepEqual(
    getRoutePermissionRequirement(
      "/00000000-0000-0000-0000-000000000001/inventory"
    ),
    {
      module: MENU_KEYS.INVENTORY,
      action: "read",
    }
  );
});

test("product classification routes use product-equivalent permission", () => {
  assert.deepEqual(
    getRoutePermissionRequirement(
      "/00000000-0000-0000-0000-000000000001/inventory/product-categories"
    ),
    {
      module: MENU_KEYS.INVENTORY_PRODUCTS,
      action: "read",
    }
  );
  assert.deepEqual(
    getRoutePermissionRequirement(
      "/00000000-0000-0000-0000-000000000001/inventory/product-subcategories"
    ),
    {
      module: MENU_KEYS.INVENTORY_PRODUCTS,
      action: "read",
    }
  );
});

test("finance routes use canonical FINANCE permission", () => {
  assert.deepEqual(
    getRoutePermissionRequirement(
      "/00000000-0000-0000-0000-000000000001/finance"
    ),
    {
      module: MENU_KEYS.FINANCE,
      action: "read",
    }
  );
  assert.deepEqual(
    getRoutePermissionRequirement(
      "/00000000-0000-0000-0000-000000000001/finance/cash-sessions"
    ),
    {
      module: MENU_KEYS.FINANCE,
      action: "read",
    }
  );
});

test("deliveries route uses canonical DELIVERIES permission", () => {
  assert.deepEqual(
    getRoutePermissionRequirement(
      "/00000000-0000-0000-0000-000000000001/deliveries"
    ),
    {
      module: MENU_KEYS.DELIVERIES,
      action: "read",
    }
  );
});

test("operations parent and sales child use distinct permissions", () => {
  assert.deepEqual(getRoutePermissionRequirement("/tenant/operations"), { module: MENU_KEYS.OPERATIONS, action: "read" });
  assert.deepEqual(getRoutePermissionRequirement("/tenant/operations/sales"), { module: MENU_KEYS.OPERATIONS_SALES, action: "read" });
});
