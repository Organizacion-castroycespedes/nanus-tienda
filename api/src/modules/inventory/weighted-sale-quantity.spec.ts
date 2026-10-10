import assert from "node:assert/strict";
import test from "node:test";
import { roundCommercialWeightKg } from "./weighted-sale-quantity";

test("commercial weight uses PostgreSQL numeric half-up rounding", () => {
  assert.equal(roundCommercialWeightKg("0.245000"), "0.245");
  assert.equal(roundCommercialWeightKg("0.2455"), "0.246");
  assert.equal(roundCommercialWeightKg("1.9995"), "2.000");
  assert.equal(roundCommercialWeightKg("0.0004"), "0.000");
});

test("commercial weight rejects signed, invalid, and over-scale values", () => {
  assert.throws(() => roundCommercialWeightKg("-0.245"), /WEIGHT_VALUE_INVALID/);
  assert.throws(() => roundCommercialWeightKg("NaN"), /WEIGHT_VALUE_INVALID/);
  assert.throws(() => roundCommercialWeightKg("0.2450001"), /WEIGHT_VALUE_INVALID/);
});
