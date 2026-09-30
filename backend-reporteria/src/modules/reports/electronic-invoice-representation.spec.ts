import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { buildElectronicInvoiceRepresentation } from "./electronic-invoice-representation";
import { buildElectronicInvoiceRepresentationTemplate } from "../pdf/templates/tickets/electronic-invoice-representation.template";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";

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
    qrPayload: "https://dian.example/qr/SETP990000007",
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
  logo: "data:image/png;base64,AAAA",
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

  assert.match(serialized, /FACTURA ELECTRÓNICA DE VENTA/);
  assert.match(serialized, /No\. SETP990000007/);
  assert.equal(serialized.includes("\u200b"), false);
  assert.equal(serialized.includes("a".repeat(48) + "\\n" + "a".repeat(48)), true);
});

test("renderer does not show acceptance state or acceptance date", () => {
  const serialized = JSON.stringify(
    buildElectronicInvoiceRepresentationTemplate(buildElectronicInvoiceRepresentation(input))
  );

  assert.doesNotMatch(serialized, /Aceptad/i);
  assert.doesNotMatch(serialized, /aceptaci/i);
  assert.doesNotMatch(serialized, /Estado/);
});

test("renderer uses FactuCore fiscal data required by DIAN when available", () => {
  const fiscal = {
    version: 1,
    documentType: "INVOICE",
    environment: "TEST",
    fullNumber: "SETP990010028",
    prefix: "SETP",
    number: 990010028,
    issueDate: "2026-09-29",
    issueTime: "22:15:09-05:00",
    dueDate: null,
    currency: "COP",
    documentKey: { type: "CUFE" as const, value: "b".repeat(96) },
    resolution: {
      number: "18760000001",
      prefix: "SETP",
      rangeStart: 990000000,
      rangeEnd: 995000000,
      validFrom: "2019-01-19",
      validTo: "2030-01-19",
    },
    issuer: {
      legalName: "SIRLEY MAYERLIS CESPEDES ANAYA",
      tradeName: "Nanus",
      personType: "NATURAL" as const,
      identificationTypeCode: "31",
      identificationNumber: "1045697508",
      verificationDigit: "5",
      fiscalResponsibilityCodes: ["R-99-PN"],
      taxSchemeId: "ZZ",
      taxSchemeName: "No aplica",
      address: "CL 18B 17F 24",
      city: "Barranquilla",
      department: "Atlántico",
      country: "Colombia",
      phone: "3022243805",
      email: "ventas@nanus.co",
    },
    customer: {
      legalName: "Chinaco",
      tradeName: null,
      personType: "NATURAL" as const,
      identificationTypeCode: "13",
      identificationNumber: "21265848",
      verificationDigit: null,
      fiscalResponsibilityCodes: [],
      taxSchemeId: null,
      taxSchemeName: null,
      address: null,
      city: "Barranquilla",
      department: null,
      country: null,
      phone: null,
      email: null,
    },
    payments: [{ formCode: "1", meansCode: "10", amount: 1800, dueDate: null }],
    lines: [{
      lineNumber: 1,
      code: "SKU-1",
      description: "Producto prueba",
      unitCode: "NIU",
      quantity: 1,
      unitPrice: 1512.61,
      discount: 0,
      lineExtensionAmount: 1512.61,
      taxAmount: 287.39,
      total: 1800,
      taxes: [{ type: "IVA", rate: 19, taxableBase: 1512.61, amount: 287.39 }],
    }],
    taxTotals: [{ type: "IVA", rate: 19, taxableBase: 1512.61, amount: 287.39 }],
    totals: { lineExtension: 1512.61, discount: 0, tax: 287.39, payable: 1800 },
    referencedDocument: null,
    notes: null,
    softwareProvider: {
      name: "SIRLEY MAYERLIS CESPEDES ANAYA",
      identificationNumber: "1045697508",
      verificationDigit: "5",
      softwareName: "FactuCore",
    },
  };
  const serialized = JSON.stringify(
    buildElectronicInvoiceRepresentationTemplate(buildElectronicInvoiceRepresentation({ ...input, fiscal }))
  );

  assert.match(serialized, /No\. SETP990010028/);
  assert.match(serialized, /NIT 1045697508-5/);
  assert.match(serialized, /Autorización de numeración DIAN No\. 18760000001/);
  assert.match(serialized, /del 990000000 al 995000000/);
  assert.match(serialized, /Vigencia hasta 19\/01\/2030/);
  assert.match(serialized, /29\/09\/2026/);
  assert.match(serialized, /22:15:09/);
  assert.match(serialized, /Contado/);
  assert.match(serialized, /Efectivo/);
  assert.match(serialized, /CC 21265848/);
  assert.match(serialized, /R-99-PN No responsable/);
  assert.match(serialized, /Cód\. SKU-1/);
  assert.match(serialized, /IVA 19%/);
  assert.match(serialized, /TOTAL A PAGAR/);
  assert.match(serialized, /Software propio del facturador: FactuCore/);
  assert.match(serialized, /ambiente de habilitación/);
  assert.doesNotMatch(serialized, /Aceptad/i);
});

test("renderer includes one centered QR drawing from the exact authoritative payload", () => {
  const document = buildElectronicInvoiceRepresentationTemplate(
    buildElectronicInvoiceRepresentation(input)
  );
  const serialized = JSON.stringify(document);
  assert.equal((document.content.filter((entry) => "canvas" in entry) ?? []).length > 0, true);
  assert.equal(serialized.includes("authoritative"), false);
  assert.match(serialized, /"alignment":"center"/);
  assert.match(serialized, /"type":"rect"/);
  const qr = document.content.find(
    (entry) =>
      "canvas" in entry &&
      Array.isArray(entry.canvas) &&
      entry.canvas.some((shape) => shape.type === "rect")
  ) as { canvas?: Array<{ w?: number; h?: number }> } | undefined;
  const qrWidth = Math.max(...(qr?.canvas ?? []).map((shape) => shape.w ?? 0));
  assert.ok(qrWidth > 0);
  assert.ok(qrWidth <= 40 * (72 / 25.4));
});

test("generated FE PDF contains a rendered QR drawing, not only a model payload", async () => {
  const engine = new PdfmakeEngine();
  const withQr = await engine.generatePdf(
    buildElectronicInvoiceRepresentationTemplate(
      buildElectronicInvoiceRepresentation({ ...input, logo: null })
    )
  );
  const withoutQr = await engine.generatePdf(
    buildElectronicInvoiceRepresentationTemplate(
      buildElectronicInvoiceRepresentation({
        ...input,
        logo: null,
        invoice: { ...input.invoice, qrPayload: null },
      })
    )
  );

  assert.equal(withQr.subarray(0, 8).toString(), "%PDF-1.3");
  assert.ok(withQr.length > withoutQr.length);
});

test("renderer includes the shared company logo when present", () => {
  const document = buildElectronicInvoiceRepresentationTemplate(
    buildElectronicInvoiceRepresentation(input)
  );
  const serialized = JSON.stringify(document);
  assert.match(serialized, /data:image\/png;base64,AAAA/);
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
