import assert from "node:assert/strict";
import test from "node:test";
import {
  fromCents,
  lineTotalCents,
  parseMoney,
  parseQuantity,
  rateToBasisPoints,
  taxBreakdown,
  toCents,
} from "./money";

test("money: parses and normalizes decimal strings without floats", () => {
  assert.equal(parseMoney("850000", "x"), "850000.00");
  assert.equal(parseMoney("29900.5", "x"), "29900.50");
  assert.equal(parseMoney(119000, "x"), "119000.00");
  assert.equal(toCents("99900.00"), 9990000n);
  assert.equal(fromCents(9990000n), "99900.00");
});

test("money: rejects negatives, more than 2 decimals and garbage", () => {
  for (const bad of ["-1", "1.234", "abc", "", "1e5", null, undefined]) {
    assert.throws(() => parseMoney(bad, "monto"), /monto/);
  }
  assert.throws(() => parseQuantity("0", "cantidad"), /cantidad/);
});

test("money: tax rate is a fraction as stored in public.taxes", () => {
  assert.equal(rateToBasisPoints("0.1900"), 1900n);
  assert.equal(rateToBasisPoints("0.19"), 1900n);
  assert.equal(rateToBasisPoints(0.05), 500n);
  assert.throws(() => rateToBasisPoints("19"), /fracción/);
});

test("money: VAT included breakdown of the annual plan rounds to pesos", () => {
  const result = taxBreakdown(toCents("850000.00"), 1900n, true);
  assert.equal(fromCents(result.baseCents), "714286.00");
  assert.equal(fromCents(result.taxCents), "135714.00");
  assert.equal(fromCents(result.totalCents), "850000.00");
});

test("money: VAT excluded adds tax on top", () => {
  const result = taxBreakdown(toCents("100000.00"), 1900n, false);
  assert.equal(fromCents(result.taxCents), "19000.00");
  assert.equal(fromCents(result.totalCents), "119000.00");
});

test("money: line total applies quantity and discount", () => {
  assert.equal(fromCents(lineTotalCents("3.00", "350000.00", "0.00")), "1050000.00");
  assert.equal(fromCents(lineTotalCents("1.00", "119000.00", "119000.00")), "0.00");
});
