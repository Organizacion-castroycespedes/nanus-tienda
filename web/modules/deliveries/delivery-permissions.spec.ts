import assert from "node:assert/strict";
import test from "node:test";
import { MENU_KEYS } from "../../domains/menu/constants";
import type { PermissionSummary } from "../../domains/menu/types";
import { canManageDeliveryDrivers } from "./delivery-permissions";
import { DELIVERY_PERMISSION_ACTIONS } from "./types";

const writableDeliveriesPermission: PermissionSummary = {
  key: MENU_KEYS.DELIVERIES,
  module: "deliveries",
  route: "/deliveries",
  accessLevel: "WRITE",
  actions: {
    [DELIVERY_PERMISSION_ACTIONS.UPDATE]: true,
  },
};

test("delivery driver management blocks USER role", () => {
  assert.equal(canManageDeliveryDrivers(writableDeliveriesPermission, "USER"), false);
});

test("delivery driver management allows admin roles with update permission", () => {
  assert.equal(
    canManageDeliveryDrivers(writableDeliveriesPermission, "SUPER_ADMIN"),
    true
  );
  assert.equal(canManageDeliveryDrivers(writableDeliveriesPermission, "ADMIN"), true);
  assert.equal(
    canManageDeliveryDrivers(writableDeliveriesPermission, "SUPER_USER"),
    true
  );
});

test("delivery driver management still needs update permission", () => {
  assert.equal(
    canManageDeliveryDrivers(
      {
        ...writableDeliveriesPermission,
        actions: {
          [DELIVERY_PERMISSION_ACTIONS.UPDATE]: false,
        },
      },
      "ADMIN"
    ),
    false
  );
});
