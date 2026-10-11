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

  it("routes explicit WEIGHT previews to weighted pricing and UNIT or legacy previews to UNIT pricing", async () => {
    const tenantId = randomUUID();
    const branchId = randomUUID();
    const productId = randomUUID();
    const calls: string[] = [];
    const service = {
      calculateLinePrice: async (input: any) => {
        calls.push(`UNIT:${input.quantity}:${input.saleMode ?? "omitted"}`);
        return { quantity: input.quantity };
      },
      calculateWeightedLinePrice: async (input: any) => {
        calls.push(`WEIGHT:${input.quantity}:${input.saleMode ?? "omitted"}`);
        return { quantity: input.quantity };
      },
    };
    const controller = new PricingController(service as any);
    const request = { user: { tenantId } } as any;
    const line = { branchId, productId, quantity: 0.245, channel: "POS" as const };

    await controller.previewLine({ ...line, saleMode: "WEIGHT" }, request);
    await controller.previewLine({ ...line, saleMode: "UNIT" }, request);
    await controller.previewLine(line, request);

    assert.deepEqual(calls, [
      "WEIGHT:0.245:omitted",
      "UNIT:0.245:omitted",
      "UNIT:0.245:omitted",
    ]);
  });

  it("rejects unknown preview sale modes", () => {
    const tenantId = randomUUID();
    const branchId = randomUUID();
    const productId = randomUUID();
    const controller = new PricingController({
      calculateLinePrice: async () => ({}),
      calculateWeightedLinePrice: async () => ({}),
    } as any);

    assert.throws(
      () => controller.previewLine(
        { branchId, productId, quantity: 1, channel: "POS", saleMode: "OTHER" as any },
        { user: { tenantId } } as any
      ),
      /saleMode must be UNIT or WEIGHT/
    );
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
          taxes: [],
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
