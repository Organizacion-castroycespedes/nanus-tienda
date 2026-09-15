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

test("maps internal EXEMPT to FactuCore NOT_APPLICABLE at the provider boundary", () => {
  const input = structuredClone(exemptLine);
  const request = new FactuCoreMapper().buildInvoiceRequest({
    context: {} as never,
    documentId: "doc",
    externalReference: "ref",
    customer: { identification: { number: "72009461", typeCode: "13" }, legalName: "Customer" },
    payment: { methodCode: "CASH" },
    lines: [input],
    totals: { subtotalAmount: 16000, discountAmount: 0, taxAmount: 0, totalAmount: 16000, currencyCode: "COP" },
  });

  assert.equal(request.lines[0].taxTreatment, "NOT_APPLICABLE");
  assert.equal(request.lines[0].taxes?.[0].taxType, "IVA");
  assert.equal(request.lines[0].taxes?.[0].rate, 0);
  assert.equal(request.lines[0].taxes?.[0].taxableBase, 16000);
  assert.equal(request.lines[0].taxes?.[0].taxAmount, 0);
  assert.equal(request.lines[0].taxes?.[0].metadata?.taxCode, "01");
  assert.deepEqual(input, exemptLine);
});

test("preserves FactuCore TAXED and EXCLUDED values", () => {
  assert.equal(mapFactuCoreTaxTreatment("TAXED"), "TAXED");
  assert.equal(mapFactuCoreTaxTreatment("EXCLUDED"), "EXCLUDED");
});

test("rejects unsupported internal tax treatment", () => {
  assert.throws(() => mapFactuCoreTaxTreatment("UNKNOWN"), /Tax treatment is not mapped/);
});
