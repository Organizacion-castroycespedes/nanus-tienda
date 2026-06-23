import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { PERMISSION_KEY } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import {
  DELIVERY_PERMISSION_ACTIONS,
} from "./deliveries.constants";
import { DeliveriesController } from "./deliveries.controller";

const getPermission = (methodName: keyof DeliveriesController) =>
  Reflect.getMetadata(
    PERMISSION_KEY,
    DeliveriesController.prototype[methodName]
  );

test("DeliveriesController: uses JwtAuthGuard and PermissionsGuard", () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, DeliveriesController);

  assert.deepEqual(guards, [JwtAuthGuard, PermissionsGuard]);
});

test("DeliveriesController: maps CRUD endpoints to delivery permissions", () => {
  assert.deepEqual(getPermission("list"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.VIEW,
  });
  assert.deepEqual(getPermission("create"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.CREATE,
  });
  assert.deepEqual(getPermission("getById"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.VIEW,
  });
  assert.deepEqual(getPermission("update"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.UPDATE,
  });
});

test("DeliveriesController: maps state endpoints to delivery permissions", () => {
  assert.deepEqual(getPermission("assign"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.ASSIGN,
  });
  assert.deepEqual(getPermission("prepare"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.ASSIGN,
  });
  assert.deepEqual(getPermission("dispatch"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.DISPATCH,
  });
  assert.deepEqual(getPermission("markDelivered"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.MARK_DELIVERED,
  });
  assert.deepEqual(getPermission("markNotDelivered"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.MARK_NOT_DELIVERED,
  });
  assert.deepEqual(getPermission("cancel"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.CANCEL,
  });
});

test("DeliveriesController: maps summary report to reports permission", () => {
  assert.deepEqual(getPermission("getSummaryReport"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.REPORTS,
  });
});
