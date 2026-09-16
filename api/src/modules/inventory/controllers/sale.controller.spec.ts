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

test("SaleController: tenant boundary comes from auth context for every sale operation", async () => {
  const calls: Array<{ operation: string; tenantId?: string; payload?: unknown }> = [];
  const saleService = {
    createSale: async (payload: unknown, actor: { tenantId?: string }) => {
      calls.push({ operation: "create", tenantId: actor.tenantId, payload });
      return { id: "sale-1" };
    },
    getSales: async (actor: { tenantId?: string }, payload: unknown) => {
      calls.push({ operation: "list", tenantId: actor.tenantId, payload });
      return [];
    },
    getSaleById: async (id: string, actor: { tenantId?: string }) => {
      calls.push({ operation: "detail", tenantId: actor.tenantId, payload: id });
      return { id };
    },
    cancelSale: async (id: string, actor: { tenantId?: string }) => {
      calls.push({ operation: "cancel", tenantId: actor.tenantId, payload: id });
      return { id };
    },
  };
  const controller = new SaleController(saleService as never, {} as never);
  const request = {
    context: {
      tenantId: "tenant-a",
      userId: "user-a",
      branchId: "branch-a",
      terminalId: "terminal-a",
      posSessionId: "pos-session-a",
      roles: ["ADMIN"],
    },
  } as never;

  await controller.create(
    {
      customerId: "customer-a",
      type: "CASH",
      items: [],
      tenantId: "tenant-b",
      branchId: "branch-b",
    } as never,
    request
  );
  await controller.list(undefined, undefined, request);
  await controller.getById("sale-from-tenant-b", request);
  await controller.cancel("sale-from-tenant-b", request);

  assert.deepEqual(
    calls.map(({ operation, tenantId }) => ({ operation, tenantId })),
    [
      { operation: "create", tenantId: "tenant-a" },
      { operation: "list", tenantId: "tenant-a" },
      { operation: "detail", tenantId: "tenant-a" },
      { operation: "cancel", tenantId: "tenant-a" },
    ]
  );
  assert.equal("tenantId" in (calls[0].payload as object), false);
  assert.equal("branchId" in (calls[0].payload as object), false);
});

