import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { REQUIRE_OPEN_CASH_SESSION_KEY } from "../../../common/decorators/require-open-cash-session.decorator";
import { PERMISSION_KEY } from "../../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { DELIVERY_PERMISSION_ACTIONS } from "../../deliveries/deliveries.constants";
import { OrderController } from "./order.controller";

const getPermission = (methodName: keyof OrderController) =>
  Reflect.getMetadata(PERMISSION_KEY, OrderController.prototype[methodName]);

const requiresOpenCashSession = (methodName: keyof OrderController) =>
  Reflect.getMetadata(
    REQUIRE_OPEN_CASH_SESSION_KEY,
    OrderController.prototype[methodName]
  );

test("OrderController: uses auth, roles and permissions guards", () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, OrderController);

  assert.deepEqual(guards, [JwtAuthGuard, RolesGuard, PermissionsGuard]);
});

test("OrderController: maps order delivery endpoints to DELIVERIES permissions", () => {
  assert.deepEqual(getPermission("getDelivery"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "READ",
    action: DELIVERY_PERMISSION_ACTIONS.VIEW,
  });
  assert.deepEqual(getPermission("createDelivery"), {
    menuKey: MENU_KEYS.DELIVERIES,
    level: "WRITE",
    action: DELIVERY_PERMISSION_ACTIONS.CREATE,
  });
  assert.equal(requiresOpenCashSession("createDelivery"), true);
  assert.equal(requiresOpenCashSession("getDelivery"), undefined);
});

test("OrderController: allows creating orders without open cash session metadata", () => {
  assert.equal(requiresOpenCashSession("create"), undefined);
});

test("OrderController: keeps open cash session requirement for operational order mutations", () => {
  assert.equal(requiresOpenCashSession("update"), true);
  assert.equal(requiresOpenCashSession("deliver"), true);
  assert.equal(requiresOpenCashSession("confirm"), true);
  assert.equal(requiresOpenCashSession("invoice"), true);
  assert.equal(requiresOpenCashSession("cancel"), true);
});

test("OrderController: normal order creation does not call deliveries service", async () => {
  let orderCreateCalled = false;
  let deliveriesCalled = false;
  const orderService = {
    createOrder: async () => {
      orderCreateCalled = true;
      return { id: "order-1" };
    },
  };
  const deliveriesService = {
    createFromOrder: async () => {
      deliveriesCalled = true;
      return { id: "delivery-1" };
    },
  };
  const controller = new OrderController(
    orderService as never,
    deliveriesService as never
  );

  const result = await controller.create(
    {
      customerId: "00000000-0000-0000-0000-000000000001",
      total: 0,
      items: [],
    },
    {
      user: {
        id: "00000000-0000-0000-0000-000000000002",
        tenantId: "00000000-0000-0000-0000-000000000003",
        roles: ["ADMIN"],
      },
    } as never
  );

  assert.deepEqual(result, { id: "order-1" });
  assert.equal(orderCreateCalled, true);
  assert.equal(deliveriesCalled, false);
});
