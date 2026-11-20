import assert from "node:assert/strict";
import test from "node:test";
import {
  QUOTATION_PDF_DEFAULT_ACCENT,
  QUOTATION_PDF_DEFAULT_PRIMARY,
  buildQuotationPdfLayout,
  formatLongDate,
  type QuotationPdfDataset,
} from "./quotation.template";

export const sampleQuotationDataset = (overrides: Partial<QuotationPdfDataset["company"]> = {}, lines = 2): QuotationPdfDataset => ({
  quotation: {
    code: "COT-000123",
    status: "APPROVED",
    issueDate: "2026-11-19",
    validUntil: "2026-12-04",
    validityDays: 15,
    branchName: "Sede Centro",
    subtotal: 11850,
    discountTotal: 1085,
    taxTotal: 2251.5,
    total: 14101.5,
    commercialTerms: "50% de anticipo y saldo contra entrega.",
    paymentDeliveryTerms: "Entrega en 3 días hábiles.",
    warrantyTerms: null,
    notes: null,
  },
  customer: {
    name: "Ferretería El Tornillo SAS",
    document: "900123456-7",
    email: "compras@tornillo.co",
    phone: "3001234567",
    address: "Calle 10 # 5-20, Bogotá",
  },
  items: Array.from({ length: lines }, (_, index) => ({
    lineNumber: index + 1,
    productCode: `SKU-${index + 1}`,
    productName: index === 0 ? "Cable eléctrico 12 AWG" : `Producto ${index + 1}`,
    unitCode: index === 0 ? "M" : "UND",
    quantity: index === 0 ? 10.85 : 2,
    finalUnitPrice: index === 0 ? 1000 : 500,
    discountPercent: index === 0 ? 10 : 0,
    promotionName: index === 0 ? "Promo cables" : null,
    taxRate: 19,
    lineTotal: index === 0 ? 12911.5 : 1190,
  })),
  taxes: [{ taxName: "IVA", taxRate: 19, taxBase: 11850, taxAmount: 2251.5 }],
  company: {
    name: "Tienda Demo",
    legalName: "Tienda Demo SAS",
    nit: "901000111",
    dv: "3",
    address: "Carrera 7 # 12-34",
    city: "Bogotá",
    phone: "6011234567",
    email: "ventas@tiendademo.co",
    website: "tiendademo.co",
    representativeName: "Ana Pérez",
    representativeDocumentType: "CC",
    representativeDocumentNumber: "52123456",
    logo: null,
    primaryColor: "#0f766e",
    accentColor: "#facc15",
    ...overrides,
  },
});

const flatten = (node: unknown): string[] => {
  if (node === null || node === undefined) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === "object") {
    const record = node as Record<string, unknown>;
    return [
      ...(typeof record.text === "string" ? [record.text] : flatten(record.text)),
      ...flatten(record.stack),
      ...flatten(record.columns),
      ...flatten((record.table as { body?: unknown } | undefined)?.body),
    ];
  }
  return [];
};

test("formatLongDate escribe la fecha en espanol", () => {
  assert.equal(formatLongDate("2026-12-04"), "4 de diciembre de 2026");
});

test("la portada usa los colores del tenant y el badge del estado", () => {
  const definition = buildQuotationPdfLayout(sampleQuotationDataset());
  const background = (definition.background as (page: number) => any)(1);
  assert.equal(background.canvas[0].color, "#0f766e");
  assert.equal(background.canvas[1].color, "#facc15");
  assert.equal((definition.background as (page: number) => any)(2), null);
  const texts = flatten(definition.content);
  assert.ok(texts.includes("COTIZACIÓN"));
  assert.ok(texts.includes("COT-000123"));
  assert.ok(texts.includes("ESTADO: APROBADA"));
});

test("sin colores validos ni logo usa los colores por defecto y las iniciales", () => {
  const definition = buildQuotationPdfLayout(
    sampleQuotationDataset({ primaryColor: "rojo", accentColor: null, logo: "http://no-es-data-uri" })
  );
  const background = (definition.background as (page: number) => any)(1);
  assert.equal(background.canvas[0].color, QUOTATION_PDF_DEFAULT_PRIMARY);
  assert.equal(background.canvas[1].color, QUOTATION_PDF_DEFAULT_ACCENT);
  const logo = (definition.content as any[])[0];
  assert.equal(logo.stack[0].canvas[0].type, "rect");
  assert.equal(logo.stack[1].columns[0].text, "TD");
});

test("usa el logo data-uri del tenant", () => {
  const definition = buildQuotationPdfLayout(sampleQuotationDataset({ logo: "data:image/png;base64,iVBORw0KGgo=" }));
  const logo = (definition.content as any[])[0];
  assert.equal(logo.image, "data:image/png;base64,iVBORw0KGgo=");
  assert.deepEqual(logo.fit, [132, 70]);
});

test("la tabla repite cabecera, no parte filas y muestra la promocion", () => {
  const definition = buildQuotationPdfLayout(sampleQuotationDataset({}, 40));
  const table = (definition.content as any[]).find((node) => node.table?.headerRows === 1).table;
  assert.equal(table.dontBreakRows, true);
  assert.equal(table.body.length, 41);
  assert.equal(table.body[0].length, 9);
  assert.equal(table.body[0][0].fillColor, "#0f766e");
  assert.ok(flatten(table.body[1]).includes("Promoción: Promo cables"));
});

test("cuadro economico, total en letras, bloques opcionales y firma", () => {
  const definition = buildQuotationPdfLayout(sampleQuotationDataset());
  const texts = flatten(definition.content);
  assert.ok(texts.includes("IVA (19%)"));
  assert.ok(texts.includes("TOTAL"));
  assert.ok(texts.includes("Catorce mil ciento un pesos con 50/100 m/cte."));
  assert.ok(texts.includes("Condiciones comerciales"));
  assert.ok(texts.includes("Forma de pago y entrega"));
  assert.ok(!texts.includes("Garantía"), "el bloque vacio no se imprime");
  assert.ok(texts.includes("Sin observaciones registradas."));
  assert.ok(texts.includes("Ana Pérez"));
  assert.ok(texts.includes("NIT: 901000111-3"));
});

test("pie institucional paginado y codigo en las paginas siguientes", () => {
  const definition = buildQuotationPdfLayout(sampleQuotationDataset());
  const footer = (definition.footer as (page: number, count: number) => any)(2, 3);
  assert.ok(flatten(footer).includes("Página 2 de 3"));
  assert.ok(flatten(footer).includes("Tienda Demo SAS"));
  assert.equal((definition.header as (page: number) => any)(1), null);
  assert.equal((definition.header as (page: number) => any)(2).text, "COT-000123");
});

test("cada estado tiene su etiqueta", () => {
  const labels: Record<string, string> = {
    DRAFT: "BORRADOR", SENT: "ENVIADA", APPROVED: "APROBADA",
    REJECTED: "RECHAZADA", CONVERTED: "CONVERTIDA", EXPIRED: "VENCIDA",
  };
  for (const [status, label] of Object.entries(labels)) {
    const dataset = sampleQuotationDataset();
    dataset.quotation.status = status as QuotationPdfDataset["quotation"]["status"];
    assert.ok(flatten(buildQuotationPdfLayout(dataset).content).includes(`ESTADO: ${label}`), status);
  }
});
