import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDeliveryTotals,
  formatMoneyInput,
} from "./delivery-totals";

test("manual delivery total equals delivery fee", () => {
  assert.deepEqual(
    calculateDeliveryTotals({
      source: "manual",
      sourceSubtotal: 90000,
      deliveryFee: "5000",
    }),
    {
      sourceSubtotal: 0,
      deliveryFee: 5000,
      total: 5000,
      hasNegativeDeliveryFee: false,
    }
  );
});

test("order delivery total adds source subtotal and delivery fee", () => {
  assert.deepEqual(
    calculateDeliveryTotals({
      source: "order",
      sourceSubtotal: 25000,
      deliveryFee: 4500,
    }),
    {
      sourceSubtotal: 25000,
      deliveryFee: 4500,
      total: 29500,
      hasNegativeDeliveryFee: false,
    }
  );
});

test("sale delivery total handles missing subtotal as zero", () => {
  assert.equal(
    calculateDeliveryTotals({
      source: "sale",
      sourceSubtotal: null,
      deliveryFee: "",
    }).total,
    0
  );
});

test("negative delivery fee is flagged and calculated as zero", () => {
  assert.deepEqual(
    calculateDeliveryTotals({
      source: "manual",
      deliveryFee: "-1000",
    }),
    {
      sourceSubtotal: 0,
      deliveryFee: 0,
      total: 0,
      hasNegativeDeliveryFee: true,
    }
  );
});

test("formatMoneyInput returns stable decimal strings", () => {
  assert.equal(formatMoneyInput(5000), "5000.00");
  assert.equal(formatMoneyInput(""), "0.00");
});
