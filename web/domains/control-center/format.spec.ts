import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCOP,
  formatDate,
  formatRate,
  isValidReason,
  newIdempotencyKey,
  normalizeMoneyInput,
} from "./format";

test("formatCOP renders pesos without decimals", () => {
  assert.match(formatCOP("850000.00").replace(/\s/g, " "), /850\.000/);
  assert.equal(formatCOP(null), "—");
});

test("normalizeMoneyInput accepts Colombian formats and rejects garbage", () => {
  assert.equal(normalizeMoneyInput("850.000"), "850000");
  assert.equal(normalizeMoneyInput("$ 29.900"), "29900");
  assert.equal(normalizeMoneyInput("99900,50"), "99900.50");
  assert.equal(normalizeMoneyInput("-5"), null);
  assert.equal(normalizeMoneyInput("abc"), null);
});

test("formatRate shows tax fraction as percent", () => {
  assert.equal(formatRate("0.1900"), "19%");
  assert.equal(formatRate("0.0500"), "5%");
});

test("formatDate uses dd/mm/yyyy", () => {
  assert.equal(formatDate("2026-12-15"), "15/12/2026");
});

test("reason must have at least 10 characters", () => {
  assert.equal(isValidReason("corto"), false);
  assert.equal(isValidReason("Firma del contrato recibida"), true);
});

test("idempotency keys are unique and server-valid", () => {
  const a = newIdempotencyKey();
  assert.notEqual(a, newIdempotencyKey());
  assert.match(a, /^[A-Za-z0-9_\-:.]{8,120}$/);
});
