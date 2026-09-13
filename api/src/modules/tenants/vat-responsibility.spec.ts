import assert from "node:assert/strict";
import test from "node:test";
import {
  isVatResponsibility,
  normalizeVatResponsibility,
  VAT_RESPONSIBILITY_VALUES,
} from "./vat-responsibility";

test("VAT responsibility has only explicit controlled values", () => {
  assert.deepEqual(VAT_RESPONSIBILITY_VALUES, [
    "RESPONSIBLE",
    "NOT_RESPONSIBLE",
    "UNKNOWN",
  ]);
  assert.equal(normalizeVatResponsibility("RESPONSIBLE"), "RESPONSIBLE");
});

test("R-99-PN is not a VAT responsibility value", () => {
  assert.equal(isVatResponsibility("R-99-PN"), false);
  assert.throws(() => normalizeVatResponsibility("R-99-PN"), /vatResponsibility/);
});
