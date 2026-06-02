import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import "reflect-metadata";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { PERMISSION_KEY } from "../../common/decorators/require-permission.decorator";
import { PromotionsController } from "./promotions.controller";

describe("PromotionsController", () => {
  it("uses dedicated promotions permission key", () => {
    const listPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      PromotionsController.prototype.list
    );
    const getByIdPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      PromotionsController.prototype.getById
    );
    const createPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      PromotionsController.prototype.create
    );
    const updatePermission = Reflect.getMetadata(
      PERMISSION_KEY,
      PromotionsController.prototype.update
    );
    const deactivatePermission = Reflect.getMetadata(
      PERMISSION_KEY,
      PromotionsController.prototype.deactivate
    );

    assert.equal(MENU_KEYS.INVENTORY_PROMOTIONS, "INVENTORY_PROMOTIONS");
    assert.deepEqual(listPermission, {
      menuKey: MENU_KEYS.INVENTORY_PROMOTIONS,
      level: "READ",
    });
    assert.deepEqual(getByIdPermission, {
      menuKey: MENU_KEYS.INVENTORY_PROMOTIONS,
      level: "READ",
    });
    assert.deepEqual(createPermission, {
      menuKey: MENU_KEYS.INVENTORY_PROMOTIONS,
      level: "WRITE",
    });
    assert.deepEqual(updatePermission, {
      menuKey: MENU_KEYS.INVENTORY_PROMOTIONS,
      level: "WRITE",
    });
    assert.deepEqual(deactivatePermission, {
      menuKey: MENU_KEYS.INVENTORY_PROMOTIONS,
      level: "WRITE",
    });

    for (const permission of [
      listPermission,
      getByIdPermission,
      createPermission,
      updatePermission,
      deactivatePermission,
    ]) {
      assert.notEqual(permission.menuKey, "INVENTORY_PRODUCTS");
    }
  });

  it("creates promotion with tenant and user from request", async () => {
    const tenantId = randomUUID();
    const userId = randomUUID();
    const productId = randomUUID();
    const calls: any[] = [];
    const controller = new PromotionsController({
      createPromotion: async (input: any) => {
        calls.push(input);
        return input;
      },
    } as any);

    const result = await controller.create(
      {
        name: "Promo",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: "2026-06-30T00:00:00.000Z",
        productIds: [productId],
      },
      {
        user: {
          id: userId,
          tenantId,
        },
      } as any
    );

    assert.equal(result.tenantId, tenantId);
    assert.equal(result.createdBy, userId);
    assert.deepEqual(calls[0].productIds, [productId]);
  });

  it("parses isActive filter", async () => {
    const tenantId = randomUUID();
    const calls: any[] = [];
    const controller = new PromotionsController({
      listPromotions: async (_tenantId: string, filters: any) => {
        calls.push({ tenantId: _tenantId, filters });
        return [];
      },
    } as any);

    await controller.list({ user: { tenantId } } as any, undefined, "false");

    assert.equal(calls[0].tenantId, tenantId);
    assert.equal(calls[0].filters.isActive, false);
  });

  it("rejects invalid isActive filter", () => {
    const tenantId = randomUUID();
    const controller = new PromotionsController({
      listPromotions: async () => [],
    } as any);

    assert.throws(
      () => controller.list({ user: { tenantId } } as any, undefined, "yes"),
      /isActive must be true or false/
    );
  });

  it("rejects request without authenticated tenant", () => {
    const controller = new PromotionsController({
      listPromotions: async () => [],
    } as any);

    assert.throws(
      () => controller.list({ user: {} } as any),
      /tenantId is required/
    );
  });
});
