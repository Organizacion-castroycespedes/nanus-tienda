import assert from "node:assert/strict";
import test from "node:test";
import { getQuantityPolicyViolation, roundQuantity } from "./quantity-policy";

test("quantity-policy: producto por unidad sin marca acepta enteros", () => {
  assert.equal(getQuantityPolicyViolation(10, { saleType: "UNIT" }), null);
  assert.equal(getQuantityPolicyViolation(1, {}), null);
});

test("quantity-policy: producto por unidad sin marca rechaza decimales", () => {
  assert.match(getQuantityPolicyViolation(10.85, { saleType: "UNIT" }) ?? "", /unidades enteras/);
  assert.match(getQuantityPolicyViolation(0.5, { saleType: "UNIT", allowsDecimalQuantity: false }) ?? "", /decimales/);
});

test("quantity-policy: producto con marca acepta hasta 2 decimales", () => {
  assert.equal(getQuantityPolicyViolation(10.85, { saleType: "UNIT", allowsDecimalQuantity: true }), null);
  assert.equal(getQuantityPolicyViolation(0.1 + 0.2, { saleType: "UNIT", allowsDecimalQuantity: true }), null);
  assert.match(
    getQuantityPolicyViolation(1.255, { saleType: "UNIT", allowsDecimalQuantity: true }) ?? "",
    /máximo 2 decimales/
  );
});

test("quantity-policy: peso no se valida aqui", () => {
  assert.equal(getQuantityPolicyViolation(1.234, { saleType: "WEIGHT" }), null);
  assert.equal(getQuantityPolicyViolation(0.5, { saleType: "BOTH" }), null);
});

test("quantity-policy: roundQuantity elimina ruido de punto flotante", () => {
  assert.equal(roundQuantity(11 - 10.85), 0.15);
});
