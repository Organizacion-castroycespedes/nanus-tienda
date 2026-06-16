import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPosCartDiscountDisplay } from "./pos-discount-display";

describe("buildPosCartDiscountDisplay", () => {
  it("returns null for product without promotion", () => {
    assert.equal(
      buildPosCartDiscountDisplay({
        baseUnitPrice: 4000,
        finalUnitPrice: 4000,
        quantity: 1,
        discountAmount: 0,
        discountTotal: 0,
        discountPercent: 0,
        isWeighable: false,
      }),
      null
    );
  });

  it("keeps compact display for quantity one", () => {
    assert.deepEqual(
      buildPosCartDiscountDisplay({
        baseUnitPrice: 4000,
        finalUnitPrice: 3600,
        quantity: 1,
        discountAmount: 400,
        discountTotal: 400,
        discountPercent: 10,
        isWeighable: false,
      }),
      {
        unitDiscount: 400,
        totalDiscount: 400,
        percent: 10,
        showLineTotal: false,
      }
    );
  });

  it("shows line total for integer quantity greater than one", () => {
    assert.deepEqual(
      buildPosCartDiscountDisplay({
        baseUnitPrice: 4000,
        finalUnitPrice: 3600,
        quantity: 2,
        discountAmount: 400,
        discountTotal: 800,
        discountPercent: 10,
        isWeighable: false,
      }),
      {
        unitDiscount: 400,
        totalDiscount: 800,
        percent: 10,
        showLineTotal: true,
      }
    );
  });

  it("shows unit and total discount for weighted quantity 1.25", () => {
    assert.deepEqual(
      buildPosCartDiscountDisplay({
        baseUnitPrice: 4000,
        finalUnitPrice: 3600,
        quantity: 1.25,
        discountAmount: 400,
        discountTotal: 500,
        discountPercent: 10,
        isWeighable: true,
      }),
      {
        unitDiscount: 400,
        totalDiscount: 500,
        percent: 10,
        showLineTotal: true,
      }
    );
  });

  it("shows line total for weighted decimal quantity below one", () => {
    assert.deepEqual(
      buildPosCartDiscountDisplay({
        baseUnitPrice: 4000,
        finalUnitPrice: 3600,
        quantity: 0.5,
        discountAmount: 400,
        discountTotal: 200,
        discountPercent: 10,
        isWeighable: true,
      }),
      {
        unitDiscount: 400,
        totalDiscount: 200,
        percent: 10,
        showLineTotal: true,
      }
    );
  });

  it("does not invent percent or show invalid values", () => {
    assert.deepEqual(
      buildPosCartDiscountDisplay({
        baseUnitPrice: 4000,
        finalUnitPrice: 3600,
        quantity: 2,
        discountAmount: Number.NaN,
        discountTotal: undefined,
        discountPercent: Number.NaN,
        isWeighable: false,
      }),
      {
        unitDiscount: 400,
        totalDiscount: 800,
        percent: null,
        showLineTotal: true,
      }
    );
  });
});
