import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import "reflect-metadata";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { PERMISSION_KEY } from "../../common/decorators/require-permission.decorator";
import { PricingController } from "./pricing.controller";

const pricingPreviewOperationalRoles = ["USER", "ADMIN", "SUPER_USER"];

describe("PricingController", () => {
  it("marks preview-line as an operational read without pricing admin grants", () => {
    const previewPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      PricingController.prototype.previewLine
    );

    assert.deepEqual(previewPermission, {
      menuKey: MENU_KEYS.INVENTORY_PRODUCTS,
      level: "READ",
      operationalRoles: pricingPreviewOperationalRoles,
    });
  });

  it("previews a line using tenant from authenticated request", async () => {
    const tenantId = randomUUID();
    const productId = randomUUID();
    const branchId = randomUUID();
    const calls: any[] = [];
    const service = {
      calculateLinePrice: async (input: any) => {
        calls.push(input);
        return {
          productId: input.productId,
          quantity: input.quantity,
        };
      },
    };
    const controller = new PricingController(service as any);

    const result = await controller.previewLine(
      {
        tenantId: randomUUID(),
        branchId,
        productId,
        quantity: 1,
        channel: "POS",
      },
      {
        user: {
          tenantId,
        },
      } as any
    );

    assert.deepEqual(result, { productId, quantity: 1 });
    assert.equal(calls[0].tenantId, tenantId);
    assert.equal(calls[0].branchId, branchId);
    assert.equal(calls[0].productId, productId);
  });

  it("rejects preview without tenant context", async () => {
    const controller = new PricingController({
      calculateLinePrice: async () => ({}),
    } as any);

    assert.throws(
      () =>
        controller.previewLine(
          {
            branchId: randomUUID(),
            productId: randomUUID(),
            quantity: 1,
            channel: "POS",
          },
          {} as any
        ),
      /tenantId is required/
    );
  });

  it("keeps preview-line compatible with promotion result fields", async () => {
    const tenantId = randomUUID();
    const productId = randomUUID();
    const branchId = randomUUID();
    const promotionId = randomUUID();
    const calls: any[] = [];
    const controller = new PricingController({
      calculateLinePrice: async (input: any) => {
        calls.push(input);
        return {
          productId: input.productId,
          quantity: input.quantity,
          baseUnitPrice: 100,
          finalUnitPrice: 90,
          discountAmount: 10,
          discountPercent: 10,
          appliedPromotionId: promotionId,
          appliedPromotionName: "Promo QA",
          taxId: null,
          taxRate: 0,
          taxBase: 90,
          taxAmount: 0,
          lineSubtotal: 90,
          lineTotal: 90,
          explanation: "active promotion applied",
        };
      },
    } as any);

    const result = await controller.previewLine(
      {
        branchId,
        productId,
        quantity: 1,
        channel: "POS",
      },
      {
        user: {
          tenantId,
        },
      } as any
    );

    assert.equal(calls[0].tenantId, tenantId);
    assert.equal(calls[0].branchId, branchId);
    assert.equal(calls[0].productId, productId);
    assert.equal(result.appliedPromotionId, promotionId);
    assert.equal(result.finalUnitPrice, 90);
  });
});
