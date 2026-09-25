import assert from "node:assert/strict";
import test from "node:test";
import { calculateDianDv, isDvApplicable } from "./dian-dv";

test("calculateDianDv computes correct Modulo 11 for NIT and CC", () => {
  // NIT 890900608 -> DV 9
  assert.equal(calculateDianDv("890900608"), "9");
  // CC 54236528 -> DV 7
  assert.equal(calculateDianDv("54236528"), "7");
  // Empty or non-numeric
  assert.equal(calculateDianDv(""), "");
  assert.equal(calculateDianDv("ABC"), "");
});

test("isDvApplicable returns true for CC, NIT, CE, NUIP, etc.", () => {
  assert.equal(isDvApplicable("31"), true); // NIT
  assert.equal(isDvApplicable("13"), true); // CC
  assert.equal(isDvApplicable("22"), true); // CE
  assert.equal(isDvApplicable("91"), true); // NUIP
});
