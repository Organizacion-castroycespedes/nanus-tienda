import assert from "node:assert/strict";
import test from "node:test";
import { assertIssuerCanBillVat } from "./issuer-vat-billing-guard";

test("IVA billing requires explicit responsible issuer", () => {
  assert.doesNotThrow(() => assertIssuerCanBillVat("RESPONSIBLE", true));
  assert.throws(() => assertIssuerCanBillVat("NOT_RESPONSIBLE", true));
  assert.throws(() => assertIssuerCanBillVat("UNKNOWN", true));
});

test("no-tax billing keeps backward-compatible behavior", () => {
  assert.doesNotThrow(() => assertIssuerCanBillVat("UNKNOWN", false));
  assert.doesNotThrow(() => assertIssuerCanBillVat("NOT_RESPONSIBLE", false));
});
