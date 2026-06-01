import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { PricingController } from "./pricing.controller";

describe("PricingController", () => {
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
});
