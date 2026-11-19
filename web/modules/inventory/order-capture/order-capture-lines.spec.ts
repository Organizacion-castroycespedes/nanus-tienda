import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOrderItemsPayload,
  buildOrderLinePricingKey,
  createOrderCaptureLine,
  getOrderLineAmounts,
  getOrderLineStockWarning,
  mapOrderItemsToCaptureLines,
  resolveOrderLineModeForExistingItem,
  type OrderCaptureLine,
  type OrderCaptureProduct,
  type OrderLineAmounts,
  type OrderLinePricingState,
} from "./order-capture-lines";

const product = (overrides: Partial<OrderCaptureProduct> & { id: string }): OrderCaptureProduct => ({
  name: overrides.id,
  price: 1000,
  ...overrides,
});

const preview = (lineTotal: number, finalUnitPrice: number) => ({
  productId: "a",
  quantity: 2,
  baseUnitPrice: finalUnitPrice,
  finalUnitPrice,
  discountAmount: 0,
  discountPercent: 0,
  appliedPromotionName: null,
  taxAmount: 0,
  lineTotal,
});

describe("order capture lines", () => {
  it("creates lines with the catalog list price", () => {
    const line = createOrderCaptureLine({ price: 2500 })({ productId: "a", quantity: 1, mode: "UNIT" });
    assert.deepEqual(line, { productId: "a", quantity: 1, mode: "UNIT", listPrice: 2500 });
    assert.equal(createOrderCaptureLine({ price: 0 })({ productId: "a", quantity: 1, mode: "UNIT" }).listPrice, 0);
  });

  it("resolves the mode of existing DRAFT items", () => {
    assert.equal(resolveOrderLineModeForExistingItem(product({ id: "w", saleType: "WEIGHT" }), 2), "WEIGHT");
    assert.equal(resolveOrderLineModeForExistingItem(product({ id: "b", saleType: "BOTH" }), 2), "UNIT");
    assert.equal(resolveOrderLineModeForExistingItem(product({ id: "b", saleType: "BOTH" }), 1.5), "WEIGHT");
    assert.equal(resolveOrderLineModeForExistingItem(undefined, 3), "UNIT");
  });

  it("groups repeated items of an existing order into one line", () => {
    const lines = mapOrderItemsToCaptureLines(
      [
        { productId: "a", orderedQuantity: 2, price: 900 },
        { productId: "a", orderedQuantity: 1, price: 900 },
        { productId: "z", orderedQuantity: 1, price: 700 },
      ],
      [product({ id: "a" })]
    );
    assert.deepEqual(lines, [
      { productId: "a", quantity: 3, mode: "UNIT", listPrice: 1000 },
      { productId: "z", quantity: 1, mode: "UNIT", listPrice: 700 },
    ]);
  });

  it("uses backend pricing only when the key matches the current quantity", () => {
    const line: OrderCaptureLine = { productId: "a", quantity: 2, mode: "UNIT", listPrice: 1000 };
    const key = buildOrderLinePricingKey({ branchId: "b1", customerId: "c1", productId: "a", quantity: 2 });
    const ready: OrderLinePricingState = { status: "ready", key, preview: preview(1800, 900) };
    assert.deepEqual(getOrderLineAmounts(line, ready, key), { unitPrice: 900, lineTotal: 1800, fromBackend: true });
    const staleKey = buildOrderLinePricingKey({ branchId: "b1", customerId: "c1", productId: "a", quantity: 3 });
    assert.deepEqual(getOrderLineAmounts(line, ready, staleKey), { unitPrice: 1000, lineTotal: 2000, fromBackend: false });
    assert.equal(getOrderLineAmounts(line, { status: "forbidden", key }, key).fromBackend, false);
  });

  it("warns when the quantity exceeds branch stock for inventory products only", () => {
    assert.deepEqual(getOrderLineStockWarning({ quantity: 5 }, { stock: 3, isInventoryable: true }), {
      available: 3,
      requested: 5,
    });
    assert.equal(getOrderLineStockWarning({ quantity: 3 }, { stock: 3 }), null);
    assert.equal(getOrderLineStockWarning({ quantity: 5 }, { stock: 0, isInventoryable: false }), null);
    assert.equal(getOrderLineStockWarning({ quantity: 5 }, { stock: undefined }), null);
    assert.deepEqual(getOrderLineStockWarning({ quantity: 1 }, { stock: -2 }), { available: 0, requested: 1 });
  });

  it("builds the order payload and total", () => {
    const lines: OrderCaptureLine[] = [
      { productId: "a", quantity: 2, mode: "UNIT", listPrice: 1000 },
      { productId: "w", quantity: 1.25, mode: "WEIGHT", listPrice: 4000 },
    ];
    const amounts = new Map<string, OrderLineAmounts>([
      ["a", { unitPrice: 900, lineTotal: 1800, fromBackend: true }],
    ]);
    assert.deepEqual(buildOrderItemsPayload(lines, amounts), {
      items: [
        { productId: "a", quantity: 2, price: 900, subtotal: 1800 },
        { productId: "w", quantity: 1.25, price: 4000, subtotal: 5000 },
      ],
      total: 6800,
    });
  });
});
