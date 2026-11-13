import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { addInventoryCaptureQuantity } from "../barcode/barcode-lines";
import {
  buildPurchaseItemsPayload,
  countPurchaseLinesWithoutCost,
  createPurchaseCaptureLine,
  getPurchaseProductDefaultCost,
  parsePurchaseCost,
  setPurchaseLineCost,
  type PurchaseCaptureLine,
} from "./purchase-capture-lines";

describe("purchase capture lines", () => {
  it("uses the product cost as default and 0 when missing", () => {
    assert.equal(getPurchaseProductDefaultCost({ cost: 1234.567 }), 1234.57);
    assert.equal(getPurchaseProductDefaultCost({ cost: 0 }), 0);
    assert.equal(getPurchaseProductDefaultCost(undefined), 0);
  });

  it("parses costs with up to 2 decimals and allows zero", () => {
    assert.equal(parsePurchaseCost("1500"), 1500);
    assert.equal(parsePurchaseCost("1500,5"), 1500.5);
    assert.equal(parsePurchaseCost("0"), 0);
    for (const value of ["-1", "abc", "1.234", "", null]) {
      assert.equal(parsePurchaseCost(value), null);
    }
  });

  it("keeps an edited cost when the same product is scanned again", () => {
    const first = addInventoryCaptureQuantity<PurchaseCaptureLine>(
      [],
      { productId: "a", mode: "UNIT", quantity: 1 },
      createPurchaseCaptureLine({ cost: 1000 })
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const edited = setPurchaseLineCost(first.lines, "a", 950);
    assert.ok(edited);
    const again = addInventoryCaptureQuantity(
      edited,
      { productId: "a", mode: "UNIT", quantity: 1 },
      createPurchaseCaptureLine({ cost: 1000 })
    );
    assert.deepEqual(again.ok && again.line, { productId: "a", mode: "UNIT", quantity: 2, cost: 950, costEdited: true });
  });

  it("rejects invalid costs and unknown lines", () => {
    const lines: PurchaseCaptureLine[] = [{ productId: "a", mode: "UNIT", quantity: 1, cost: 1, costEdited: false }];
    assert.equal(setPurchaseLineCost(lines, "a", -5), null);
    assert.equal(setPurchaseLineCost(lines, "z", 5), null);
  });

  it("builds the purchase payload and flags lines without cost", () => {
    const lines: PurchaseCaptureLine[] = [
      { productId: "a", mode: "UNIT", quantity: 3, cost: 1000, costEdited: false },
      { productId: "w", mode: "WEIGHT", quantity: 1.5, cost: 2333.33, costEdited: true },
      { productId: "z", mode: "UNIT", quantity: 1, cost: 0, costEdited: false },
    ];
    assert.deepEqual(buildPurchaseItemsPayload(lines), {
      items: [
        { productId: "a", quantity: 3, cost: 1000, subtotal: 3000 },
        { productId: "w", quantity: 1.5, cost: 2333.33, subtotal: 3500 },
        { productId: "z", quantity: 1, cost: 0, subtotal: 0 },
      ],
      total: 6500,
    });
    assert.equal(countPurchaseLinesWithoutCost(lines), 1);
  });
});
