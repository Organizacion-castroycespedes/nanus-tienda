import assert from "node:assert/strict";
import test from "node:test";
import { formatPercent, stockStatusLabel } from "./inventory-bi-valuation-formatters";

test("valuation presentation keeps percentages readable and states user-facing", () => {
  assert.equal(formatPercent("0"), "0,00%");
  assert.equal(formatPercent("100"), "100,00%");
  assert.equal(formatPercent("33.333333333333333333"), "33,33%");
  assert.equal(formatPercent(null), "No disponible");
  assert.equal(stockStatusLabel("WITH_STOCK"), "Con stock");
  assert.equal(stockStatusLabel("OUT_OF_STOCK"), "Agotado");
  assert.equal(stockStatusLabel("NEGATIVE"), "Stock negativo");
});
