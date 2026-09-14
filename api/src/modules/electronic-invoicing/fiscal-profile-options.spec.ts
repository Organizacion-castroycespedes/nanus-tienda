import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FISCAL_PERSON_TYPE_OPTIONS,
  FISCAL_RESPONSIBILITY_OPTIONS,
  FISCAL_TAX_REGIME_OPTIONS,
  isSupportedFiscalResponsibility,
  isSupportedTaxRegime,
} from "./fiscal-profile-options";

test("fiscal review exposes only controlled domain values", () => {
  assert.deepEqual(FISCAL_PERSON_TYPE_OPTIONS, ["NATURAL", "JURIDICA"]);
  assert.deepEqual(FISCAL_TAX_REGIME_OPTIONS, ["ORDINARIO"]);
  assert.deepEqual(FISCAL_RESPONSIBILITY_OPTIONS, ["R-99-PN", "O-13"]);
  assert.equal(isSupportedFiscalResponsibility("R-99-PN"), true);
  assert.equal(isSupportedFiscalResponsibility("invented"), false);
  assert.equal(isSupportedTaxRegime("ORDINARIO"), true);
  assert.equal(isSupportedTaxRegime("SIMPLE"), false);
});
