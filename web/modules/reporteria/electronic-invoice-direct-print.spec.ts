import test from "node:test";
import assert from "node:assert/strict";
import { buildElectronicInvoiceTicketPayload } from "./electronic-invoice-direct-print";
import type { ElectronicInvoicePrintDataset, PosSaleTicketPrintDataset } from "./types";

const sale: PosSaleTicketPrintDataset = {
  tenantId: "tenant-1",
  ticket: {
    header: {
      saleId: "sale-1", date: "2026-09-12T12:00:00.000Z", tenantName: "Empresa QA",
      branch: "Sucursal 1", branchId: "branch-1", terminal: "Caja 1", terminalId: "terminal-1",
      cashier: "Operador", customer: "Cliente QA", status: "CONFIRMED", paymentStatus: "PAID",
    },
    items: [{ productName: "Producto largo para validar envoltura térmica", quantity: 1.5, unitPrice: 1000, subtotal: 1500 }],
    paymentBreakdown: [{ method: "Efectivo", amount: 1500 }, { method: "Tarjeta", amount: 500 }],
    totals: { subtotal: 2000, taxes: 0, total: 2000, paid: 2000, change: 0, balance: 0 },
  },
};

const invoice: ElectronicInvoicePrintDataset = {
  saleId: "sale-1", electronicDocumentId: "doc-1", status: "ACCEPTED", documentNumber: "FE-1001",
  cufe: "CUFE-AUTHORITATIVE", acceptedAt: "2026-09-12T12:01:00.000Z", providerStatusCode: null,
  providerStatusMessage: null, trackingId: null, representationAvailable: true,
  qrPayload: "https://validacion.example/fe/1001",
  customerFiscalSnapshot: { name: "Cliente fiscal QA", identificationType: "CC", identificationNumber: "1", address: "Calle 1", country: "Colombia", department: "Antioquia", municipality: "Medellín", phone: null, email: null, taxRegime: "IVA", fiscalResponsibilityCodes: [] },
  taxLines: [{ type: "IVA", code: "01", rate: 19, taxableBase: 1680.67, amount: 319.33 }],
};

test("electronic invoice thermal payload uses persisted accepted values and payments", () => {
  const payload = buildElectronicInvoiceTicketPayload(invoice, sale);
  assert.equal(payload.ticketType, "ELECTRONIC_INVOICE");
  assert.match(payload.content.lines?.join("\n") ?? "", /FE-1001/);
  assert.match(payload.content.lines?.join("\n") ?? "", /CUFE-AUTHORITATIVE/);
  assert.match(payload.content.lines?.join("\n") ?? "", /Tarjeta/);
  assert.match(payload.content.lines?.join("\n") ?? "", /1\.5/);
});

for (const status of ["PENDING", "PROCESSING", "REJECTED", "CANCELLED"] as const) {
  test(`status ${status} cannot masquerade as accepted invoice`, () => {
    assert.throws(() => buildElectronicInvoiceTicketPayload({ ...invoice, status }, sale));
  });
}

test("missing document number fails closed", () => {
  assert.throws(() => buildElectronicInvoiceTicketPayload({ ...invoice, documentNumber: null }, sale));
});

test("accepted invoice remains printable when QR is not persisted", () => {
  const payload = buildElectronicInvoiceTicketPayload({ ...invoice, qrPayload: null }, sale);
  assert.equal(payload.ticketType, "ELECTRONIC_INVOICE");
  assert.doesNotMatch(payload.content.lines?.join("\n") ?? "", /QR autorizado/);
});

test("authoritative QR payload is preserved exactly", () => {
  const qr = "https://catalogo.dian.gov.co/qr/SETP990000009";
  const payload = buildElectronicInvoiceTicketPayload({ ...invoice, qrPayload: qr }, sale);
  assert.match(payload.content.lines?.join("\n") ?? "", new RegExp(`QR autorizado: ${qr}`));
});
