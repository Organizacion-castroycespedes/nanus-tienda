import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { PromotionsController } from "./promotions.controller";

describe("PromotionsController", () => {
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
});
