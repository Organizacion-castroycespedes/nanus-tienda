import assert from "node:assert/strict";
import test from "node:test";
import {
  PRINTABLE_SECTION_ORDER,
  buildCanonicalElectronicInvoiceDocument,
  buildCanonicalPosDocument,
  canonicalToElectronicInvoicePayload,
  canonicalToSaleTicketPayload,
} from "./canonical-printable-document";
import type { ElectronicInvoicePrintDataset, PosSaleTicketPrintDataset } from "./types";

const sale: PosSaleTicketPrintDataset = {
  tenantId: "tenant-1",
  company: {
    legalName: "Razón Social QA", nit: "900123", dv: "4", taxResponsibilities: null,
    regime: null, vatResponsibility: null, address: "Calle 1", city: "Bogotá", department: "Cundinamarca",
    country: "Colombia", phone: "3000000000", email: "qa@example.test", website: null, logo: "data:image/png;base64,logo",
    branchName: "Sucursal 1", branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null,
    branchPhone: null, branchEmail: null,
  },
  ticket: {
    header: { saleId: "sale-1", date: "2026-09-15T10:00:00Z", tenantName: "Legacy", branch: "Sucursal 1", branchId: "branch-1", terminal: "Terminal 1", terminalId: "terminal-1", cashier: "Cajero", customer: "Cliente", status: "CONFIRMED", paymentStatus: "PAID" },
    items: [{ productName: "Producto", quantity: 1, unitPrice: 32000, subtotal: 32000 }],
    paymentBreakdown: [{ method: "Efectivo", amount: 32000 }],
    totals: { subtotal: 32000, taxes: 0, total: 32000, paid: 32000, change: 0, balance: 0 },
    payments: [],
  },
};

const invoice: ElectronicInvoicePrintDataset = {
  saleId: "sale-1", electronicDocumentId: "doc-1", status: "ACCEPTED", documentNumber: "SETP990000009",
  cufe: "CUFE", acceptedAt: "2026-09-15T10:01:00Z", providerStatusCode: "100", providerStatusMessage: null,
  trackingId: null, representationAvailable: true, qrPayload: "authoritative-qr",
  customerFiscalSnapshot: { name: "Cliente fiscal", identificationType: "CC", identificationNumber: "1", address: "Calle 2", country: "Colombia", department: "Cundinamarca", municipality: "Bogotá", phone: null, email: null, taxRegime: null, fiscalResponsibilityCodes: [] },
  taxLines: [],
};

test("canonical POS and FE documents preserve shared semantic fields and order", () => {
  const pos = buildCanonicalPosDocument(sale);
  const fe = buildCanonicalElectronicInvoiceDocument(invoice, sale);
  assert.deepEqual(pos.sections, PRINTABLE_SECTION_ORDER);
  assert.deepEqual(fe.sections, PRINTABLE_SECTION_ORDER);
  assert.equal(pos.company.legalName, fe.company.legalName);
  assert.equal(pos.company.logo, fe.company.logo);
  assert.deepEqual(pos.items, fe.items);
  assert.deepEqual(pos.totals, fe.totals);
  assert.deepEqual(pos.payments, fe.payments);
  assert.equal(fe.identity.documentNumber, "SETP990000009");
  assert.equal(fe.regulatory?.cufe, "CUFE");
  assert.equal(fe.regulatory?.qrPayload, "authoritative-qr");
});

test("thermal adapters receive canonical values without technical metadata", () => {
  const pos = canonicalToSaleTicketPayload(buildCanonicalPosDocument(sale));
  const fe = canonicalToElectronicInvoicePayload(buildCanonicalElectronicInvoiceDocument(invoice, sale));
  assert.equal(pos.content.businessName, "Razón Social QA");
  assert.equal(pos.content.title, "VENTA");
  assert.equal(pos.content.qrPayload, undefined);
  assert.equal(fe.content.businessName, "Razón Social QA");
  assert.equal(fe.content.cufe, "CUFE");
  assert.equal(fe.content.qrPayload, "authoritative-qr");
  assert.equal("saleId" in pos.content, false);
  assert.equal("terminalId" in pos.content, false);
});
