import assert from "node:assert/strict";
import test from "node:test";
import { FactuCoreMapper, mapFactuCoreTaxTreatment } from "../src/modules/electronic-billing/providers/factucore/factucore.mapper";

const exemptLine = {
  description: "Contra Muslo",
  quantity: 1,
  unitCode: "UND",
  unitPrice: 16000,
  subtotalAmount: 16000,
  taxAmount: 0,
  totalAmount: 16000,
  taxTreatment: "EXEMPT",
  taxes: [{ type: "VAT", code: "01", schemeId: "01", schemeName: "Exento", rate: 0, taxableBase: 16000, amount: 0 }],
};

const buildRequest = (lines: unknown[]) => new FactuCoreMapper().buildInvoiceRequest({
  context: {} as never,
  documentId: "doc",
  externalReference: "ref",
  customer: { identification: { number: "72009461", typeCode: "13" }, legalName: "Customer" },
  payment: { methodCode: "CASH" },
  lines,
  totals: { subtotalAmount: 16000, discountAmount: 0, taxAmount: 0, totalAmount: 16000, currencyCode: "COP" },
} as never);

test("maps the rejected QA EXEMPT shape to FactuCore NOT_APPLICABLE without line taxes", () => {
  const input = structuredClone(exemptLine);
  const request = buildRequest([input]);
  const serializedLine = JSON.parse(JSON.stringify(request.lines[0])) as Record<string, unknown>;

  assert.equal(request.lines[0].taxTreatment, "NOT_APPLICABLE");
  assert.equal(request.lines[0].taxes, undefined);
  assert.equal(Object.hasOwn(serializedLine, "taxes"), false);
  assert.deepEqual(input, exemptLine);
});

test("omits line taxes for EXCLUDED while preserving the internal tax facts", () => {
  const input = { ...structuredClone(exemptLine), taxTreatment: "EXCLUDED" };
  const request = buildRequest([input]);

  assert.equal(request.lines[0].taxTreatment, "EXCLUDED");
  assert.equal(request.lines[0].taxes, undefined);
  assert.deepEqual(input.taxes, exemptLine.taxes);
});

test("preserves taxes for TAXED lines, including explicit zero-rate TAXED lines", () => {
  const taxed = {
    ...structuredClone(exemptLine),
    taxTreatment: "TAXED",
    taxAmount: 3040,
    totalAmount: 19040,
    taxes: [{ type: "VAT", code: "01", schemeId: "01", schemeName: "IVA", rate: 19, taxableBase: 16000, amount: 3040 }],
  };
  const zeroRateTaxed = {
    ...structuredClone(exemptLine),
    taxTreatment: "TAXED",
    taxes: [{ type: "VAT", code: "01", schemeId: "01", schemeName: "IVA 0%", rate: 0, taxableBase: 16000, amount: 0 }],
  };
  const request = buildRequest([taxed, zeroRateTaxed]);

  assert.equal(request.lines[0].taxTreatment, "TAXED");
  assert.equal(request.lines[0].taxes?.length, 1);
  assert.equal(request.lines[0].taxes?.[0].rate, 19);
  assert.equal(request.lines[0].taxes?.[0].taxAmount, 3040);
  assert.equal(request.lines[1].taxTreatment, "TAXED");
  assert.equal(request.lines[1].taxes?.length, 1);
  assert.equal(request.lines[1].taxes?.[0].rate, 0);
});

test("normalizes Manus fractional tax rates to FactuCore percentage points", () => {
  const request = buildRequest([{
    ...structuredClone(exemptLine),
    taxTreatment: "TAXED",
    taxes: [{ type: "VAT", code: "01", schemeId: "01", schemeName: "IVA 19%", rate: 0.19, taxableBase: 46218.49, amount: 8781.51 }],
  }]);

  assert.equal(request.lines[0].taxes?.[0].rate, 19);
  assert.equal(request.lines[0].taxes?.[0].taxableBase, 46218.49);
  assert.equal(request.lines[0].taxes?.[0].taxAmount, 8781.51);
});

test("maps the configured ad-valorem consumption component to its enclosing INC TaxScheme", () => {
  const request = buildRequest([{
    ...structuredClone(exemptLine),
    taxTreatment: "TAXED",
    taxes: [{
      type: "AD_VALOREM",
      code: "36",
      schemeId: "36",
      schemeName: "Impuesto ad valórem",
      rate: 25,
      taxableBase: 76000,
      amount: 19000,
    }],
  }]);

  const tax = request.lines[0].taxes?.[0];
  assert.equal(request.lines[0].taxTreatment, "TAXED");
  assert.equal((tax?.metadata as Record<string, unknown>).taxSchemeId, "04");
  assert.equal((tax?.metadata as Record<string, unknown>).taxCode, "36");
});

test("maps catalog consumption tax types to the FactuCore INC TaxScheme", () => {
  const request = buildRequest([{
    ...structuredClone(exemptLine),
    taxTreatment: "TAXED",
    taxes: [
      { type: "BEER_CONSUMPTION", code: "30", schemeId: "30", schemeName: "Impuesto al consumo de cervezas y refajos", rate: 10, taxableBase: 100, amount: 10 },
      { type: "NATIONAL_CONSUMPTION", code: "04", schemeId: "04", schemeName: "Impuesto nacional al consumo", rate: 8, taxableBase: 100, amount: 8 },
      { type: "LIQUOR_CONSUMPTION", code: "32", schemeId: "32", schemeName: "Impuesto al consumo de licores", rate: 5, taxableBase: 100, amount: 5 },
    ],
  }]);

  assert.deepEqual(
    request.lines[0].taxes?.map((tax) => (tax.metadata as Record<string, unknown>).taxSchemeId),
    ["04", "04", "04"],
  );
});

test("maps mixed TAXED, EXEMPT, and EXCLUDED lines to validation-compatible FactuCore shapes", () => {
  const taxed = {
    ...structuredClone(exemptLine),
    taxTreatment: "TAXED",
    taxes: [{ type: "VAT", code: "01", schemeId: "01", schemeName: "IVA", rate: 19, taxableBase: 16000, amount: 3040 }],
  };
  const excluded = { ...structuredClone(exemptLine), taxTreatment: "EXCLUDED" };
  const request = buildRequest([taxed, structuredClone(exemptLine), excluded]);

  assert.deepEqual(
    request.lines.map((line) => ({ taxTreatment: line.taxTreatment, taxesCount: line.taxes?.length ?? 0 })),
    [
      { taxTreatment: "TAXED", taxesCount: 1 },
      { taxTreatment: "NOT_APPLICABLE", taxesCount: 0 },
      { taxTreatment: "EXCLUDED", taxesCount: 0 },
    ],
  );
});

test("preserves FactuCore TAXED and EXCLUDED values", () => {
  assert.equal(mapFactuCoreTaxTreatment("TAXED"), "TAXED");
  assert.equal(mapFactuCoreTaxTreatment("EXCLUDED"), "EXCLUDED");
});

test("rejects unsupported internal tax treatment", () => {
  assert.throws(() => mapFactuCoreTaxTreatment("UNKNOWN"), /Tax treatment is not mapped/);
});
