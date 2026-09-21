import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateProductPrices } from "./product-price-calculator";

describe("calculateProductPrices", () => {
  it("calculates included VAT 19% from the final price", () => {
    assert.deepEqual(
      calculateProductPrices(119000, [
        { rate: 0.19, calculationMethodCode: "PERCENTAGE", isIncluded: true },
      ]),
      { priceWithTax: 119000, priceWithoutTax: 100000 }
    );
  });

  it("keeps the final price as the base when no tax is assigned", () => {
    assert.deepEqual(calculateProductPrices(119000, []), {
      priceWithTax: 119000,
      priceWithoutTax: 119000,
    });
  });

  it("does not apply a fixed liquor tax as percentage", () => {
    assert.deepEqual(
      calculateProductPrices(77000, [
        {
          rate: 0,
          calculationMethodCode: "PER_ALCOHOL_DEGREE_VOLUME",
          isIncluded: true,
        },
      ]),
      { priceWithTax: 77000, priceWithoutTax: 77000 }
    );
  });
});
