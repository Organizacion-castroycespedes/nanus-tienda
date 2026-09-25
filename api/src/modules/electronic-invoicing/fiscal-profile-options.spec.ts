import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FISCAL_PERSON_TYPE_OPTIONS,
  FISCAL_RESPONSIBILITY_OPTIONS,
  FISCAL_TAX_REGIME_OPTIONS,
  formatFiscalProfileIncompleteMessage,
  formatUnsupportedFiscalValueMessage,
  isSupportedFiscalResponsibility,
  isSupportedTaxRegime,
} from "./fiscal-profile-options";

test("fiscal review exposes only controlled domain values", () => {
  assert.deepEqual(FISCAL_PERSON_TYPE_OPTIONS, ["NATURAL", "JURIDICA"]);
  assert.deepEqual(FISCAL_TAX_REGIME_OPTIONS, [
    "ORDINARIO",
    "NO_RESPONSABLE",
    "SIMPLE",
    "ESPECIAL",
  ]);
  assert.deepEqual(FISCAL_RESPONSIBILITY_OPTIONS, [
    "R-99-PN",
    "O-13",
    "O-15",
    "O-23",
    "O-47",
  ]);
  assert.equal(isSupportedFiscalResponsibility("R-99-PN"), true);
  assert.equal(isSupportedFiscalResponsibility("O-15"), true);
  assert.equal(isSupportedFiscalResponsibility("O-23"), true);
  assert.equal(isSupportedFiscalResponsibility("O-47"), true);
  assert.equal(isSupportedFiscalResponsibility("invented"), false);
  assert.equal(isSupportedTaxRegime("ORDINARIO"), true);
  assert.equal(isSupportedTaxRegime("NO_RESPONSABLE"), true);
  assert.equal(isSupportedTaxRegime("SIMPLE"), true);
  assert.equal(isSupportedTaxRegime("ESPECIAL"), true);
  assert.equal(
    formatFiscalProfileIncompleteMessage(["personType", "taxResponsibilities"]),
    "Completa los datos fiscales requeridos: tipo de persona, responsabilidad fiscal.",
  );
  assert.equal(
    formatUnsupportedFiscalValueMessage("responsibility", "O-23"),
    'El valor "O-23" no es válido para responsabilidad fiscal. Selecciona una opción disponible.',
  );
});
