import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addInventoryCaptureQuantity,
  getInventoryReceiptRemaining,
  parseInventoryQuantity,
  prepareInventoryReceiptQuantity,
  removeInventoryCaptureLine,
  resolveInventoryProductSaleType,
  setInventoryCaptureQuantity,
  type InventoryCaptureLine,
  type InventoryReceiptItem,
} from "./barcode-lines";

type PricedLine = InventoryCaptureLine & { price: number };
const create = (base: InventoryCaptureLine): PricedLine => ({ ...base, price: 1000 });

describe("inventory product sale type", () => {
  it("uses the explicit sale type first", () => {
    assert.equal(resolveInventoryProductSaleType({ saleType: "BOTH", unitCode: "kg" }), "BOTH");
  });

  it("infers WEIGHT from flags, units or product type", () => {
    assert.equal(resolveInventoryProductSaleType({ soldByWeight: true }), "WEIGHT");
    assert.equal(resolveInventoryProductSaleType({ unitCode: " KG " }), "WEIGHT");
    assert.equal(resolveInventoryProductSaleType({ productType: "Granel" }), "WEIGHT");
  });

  it("defaults to UNIT", () => {
    assert.equal(resolveInventoryProductSaleType({ unitCode: "und" }), "UNIT");
  });
});

describe("inventory quantity parsing", () => {
  it("accepts integers and up to 2 decimals with comma or dot", () => {
    assert.equal(parseInventoryQuantity("3"), 3);
    assert.equal(parseInventoryQuantity("1,25"), 1.25);
    assert.equal(parseInventoryQuantity(" 0.5 "), 0.5);
    assert.equal(parseInventoryQuantity(2.75), 2.75);
  });

  it("rejects zero, negatives, text and more than 2 decimals", () => {
    for (const value of ["0", "-1", "abc", "1.255", "", null, undefined]) {
      assert.equal(parseInventoryQuantity(value), null);
    }
  });
});

describe("inventory capture lines", () => {
  it("creates a line for a new product", () => {
    const result = addInventoryCaptureQuantity<PricedLine>([], { productId: "a", mode: "UNIT", quantity: 1 }, create);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.created, true);
    assert.deepEqual(result.ok && result.lines, [{ productId: "a", mode: "UNIT", quantity: 1, price: 1000 }]);
  });

  it("increments an existing line without duplicating it and keeps extra fields", () => {
    const lines: PricedLine[] = [{ productId: "a", mode: "UNIT", quantity: 2, price: 1500 }];
    const result = addInventoryCaptureQuantity(lines, { productId: "a", mode: "UNIT", quantity: 1 }, create);
    assert.equal(result.ok && result.lines.length, 1);
    assert.deepEqual(result.ok && result.line, { productId: "a", mode: "UNIT", quantity: 3, price: 1500 });
  });

  it("adds weights without floating point drift", () => {
    let lines: PricedLine[] = [];
    for (const quantity of [0.1, 0.2, 0.7]) {
      const result = addInventoryCaptureQuantity(lines, { productId: "w", mode: "WEIGHT", quantity }, create);
      assert.equal(result.ok, true);
      if (result.ok) lines = result.lines;
    }
    assert.equal(lines[0].quantity, 1);
  });

  it("rejects mixing unit and weight on the same line", () => {
    const lines: PricedLine[] = [{ productId: "w", mode: "WEIGHT", quantity: 1.5, price: 1 }];
    const result = addInventoryCaptureQuantity(lines, { productId: "w", mode: "UNIT", quantity: 1 }, create);
    assert.deepEqual(result, { ok: false, reason: "MODE_MISMATCH", existingMode: "WEIGHT" });
  });

  it("rejects invalid quantities", () => {
    assert.equal(addInventoryCaptureQuantity([], { productId: "a", mode: "UNIT", quantity: 0 }, create).ok, false);
    assert.equal(addInventoryCaptureQuantity([], { productId: "a", mode: "WEIGHT", quantity: 1.234 }, create).ok, false);
  });

  it("sets and removes lines", () => {
    const lines: PricedLine[] = [
      { productId: "a", mode: "UNIT", quantity: 2, price: 1 },
      { productId: "b", mode: "UNIT", quantity: 1, price: 1 },
    ];
    const set = setInventoryCaptureQuantity(lines, "a", 5);
    assert.equal(set.ok && set.lines[0].quantity, 5);
    assert.deepEqual(setInventoryCaptureQuantity(lines, "a", 0), { ok: false, reason: "INVALID_QUANTITY" });
    assert.deepEqual(setInventoryCaptureQuantity(lines, "z", 1), { ok: false, reason: "LINE_NOT_FOUND" });
    assert.deepEqual(removeInventoryCaptureLine(lines, "a").map((line) => line.productId), ["b"]);
  });
});

describe("inventory receipt preparation", () => {
  const items: InventoryReceiptItem[] = [
    { id: "i1", productId: "leche", orderedQuantity: 3, receivedQuantity: 1 },
    { id: "i2", productId: "leche", orderedQuantity: 2, receivedQuantity: 0 },
    { id: "i3", productId: "queso", orderedQuantity: 1.5, receivedQuantity: 0 },
  ];

  it("adds to the first line of the product with pending quantity", () => {
    const result = prepareInventoryReceiptQuantity(items, {}, "leche", 1);
    assert.deepEqual(result, { ok: true, purchaseItemId: "i1", prepared: { i1: 1 }, remaining: 1 });
  });

  it("moves to the next line when the first is fully prepared", () => {
    const result = prepareInventoryReceiptQuantity(items, { i1: 2 }, "leche", 1);
    assert.equal(result.ok && result.purchaseItemId, "i2");
  });

  it("rejects quantities above the pending (zero tolerance)", () => {
    const result = prepareInventoryReceiptQuantity(items, { i1: 2, i2: 2 }, "leche", 1);
    assert.deepEqual(result, { ok: false, reason: "EXCEEDS_PENDING", remaining: 0 });
    const weight = prepareInventoryReceiptQuantity(items, {}, "queso", 1.75);
    assert.deepEqual(weight, { ok: false, reason: "EXCEEDS_PENDING", remaining: 1.5 });
  });

  it("rejects products that are not in the purchase", () => {
    assert.deepEqual(prepareInventoryReceiptQuantity(items, {}, "pan", 1), { ok: false, reason: "NOT_IN_DOCUMENT" });
  });

  it("computes the remaining quantity per line", () => {
    assert.equal(getInventoryReceiptRemaining(items[0], { i1: 0.5 }), 1.5);
    assert.equal(getInventoryReceiptRemaining(items[1], { i2: 5 }), 0);
  });
});
