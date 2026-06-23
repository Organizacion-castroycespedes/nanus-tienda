import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { PERMISSION_KEY } from "../../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { DELIVERY_PERMISSION_ACTIONS } from "../../deliveries/deliveries.constants";
import { SaleController } from "./sale.controller";

const getPermission = (methodName: keyof SaleController) =>
  Reflect.getMetadata(PERMISSION_KEY, SaleController.prototype[methodName]);

test("SaleController: uses auth, roles and permissions guards", () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, SaleController);

  assert.deepEqual(guards, [JwtAuthGuard, RolesGuard, PermissionsGuard]);
});

test("SaleController: maps delivery endpoints to DELIVERIES permissions", () => {
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
});

test("SaleController: normal sale creation does not call deliveries service", async () => {
  let saleCreateCalled = false;
  let deliveriesCalled = false;
  const saleService = {
    createSale: async () => {
      saleCreateCalled = true;
      return { id: "sale-1" };
    },
  };
  const deliveriesService = {
    createFromSale: async () => {
      deliveriesCalled = true;
      return { id: "delivery-1" };
    },
  };
  const controller = new SaleController(saleService as never, deliveriesService as never);

  const result = await controller.create(
    {
      customerId: "00000000-0000-0000-0000-000000000001",
      type: "CASH",
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

  assert.deepEqual(result, { id: "sale-1" });
  assert.equal(saleCreateCalled, true);
  assert.equal(deliveriesCalled, false);
});
