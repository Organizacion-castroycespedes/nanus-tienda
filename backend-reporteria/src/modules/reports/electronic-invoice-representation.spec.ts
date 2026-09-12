import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { buildElectronicInvoiceRepresentation } from "./electronic-invoice-representation";
import { buildElectronicInvoiceRepresentationTemplate } from "../pdf/templates/tickets/electronic-invoice-representation.template";

const input = {
  status: "ACCEPTED" as const,
  issuer: {
    name: "Comercio QA",
    identificationType: "NIT",
    identificationNumber: "900000001-1",
    address: "Calle 1",
    country: "Colombia",
    department: "Atlántico",
    municipality: "Barranquilla",
  },
  customer: {
    name: "Cliente QA",
    identificationType: "CC",
    identificationNumber: "100000001",
    address: "Carrera 2",
    country: "Colombia",
    department: "Atlántico",
    municipality: "Barranquilla",
  },
  invoice: {
    prefix: "SETP",
    number: "SETP990000007",
    issuedAt: "2026-09-11T10:00:00.000Z",
    acceptedAt: "2026-09-11T10:01:00.000Z",
    providerStatusCode: "100",
    providerStatusMessage: "Aceptado",
    trackingId: "tracking-1",
    cufe: "a".repeat(96),
  },
  sale: {
    saleId: "sale-1",
    items: [
      {
        productName: "Producto",
        quantity: 2,
        unitValue: 50,
        discount: 0,
        tax: 19,
        subtotal: 100,
        total: 119,
      },
    ],
    paymentMethod: "Efectivo",
    subtotal: 100,
    discounts: 0,
    taxes: 19,
    total: 119,
  },
};

test("accepted representation keeps fiscal metadata and location", () => {
  const result = buildElectronicInvoiceRepresentation(input);

  assert.equal(result.documentType, "ELECTRONIC_INVOICE_REPRESENTATION");
  assert.equal(result.status, "ACCEPTED");
  assert.equal(result.invoice.cufe, input.invoice.cufe);
  assert.equal(result.invoice.number, "SETP990000007");
  assert.equal(result.customer.municipality, "Barranquilla");
  assert.equal(result.sale.paymentMethod, "Efectivo");
});

test("non-accepted documents cannot become accepted representations", () => {
  assert.throws(
    () => buildElectronicInvoiceRepresentation({ ...input, status: "PENDING" }),
    BadRequestException
  );
  assert.throws(
    () => buildElectronicInvoiceRepresentation({ ...input, status: "REJECTED" }),
    BadRequestException
  );
});

test("renderer includes long CUFE as breakable content", () => {
  const document = buildElectronicInvoiceRepresentationTemplate(
    buildElectronicInvoiceRepresentation(input)
  );
  const serialized = JSON.stringify(document);

  assert.match(serialized, /Factura electrónica/);
  assert.equal(serialized.includes("\u200b"), true);
});

test("renderer uses tax breakdown lines when provided", () => {
  const document = buildElectronicInvoiceRepresentationTemplate(
    buildElectronicInvoiceRepresentation({
      ...input,
      sale: {
        ...input.sale,
        taxBreakdown: [
          {
            label: "IVA 19%",
            dianCode: "01",
            taxTypeCode: "VAT",
            taxBase: 100,
            taxAmount: 19,
          },
        ],
      },
    })
  );
  const serialized = JSON.stringify(document);

  assert.match(serialized, /IVA 19%/);
  assert.doesNotMatch(serialized, /"Impuestos"/);
});
