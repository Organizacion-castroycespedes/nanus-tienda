import assert from "node:assert/strict";
import test from "node:test";
import { buildContractDocument, contractPdfFileName, embeddedLogo, formatRate, taxLabel, type ContractPdfInput } from "./contract-pdf";
import { DEFAULT_CONTRACT_CLAUSES, applyPaymentInstructions, loadContractTerms, parseContractTerms } from "./contract-terms";

const input = (overrides: Partial<ContractPdfInput["contract"]> = {}): ContractPdfInput => ({
  issuedOn: "2026-11-10",
  issuer: {
    name: "SIRLEY MAYERLIS CESPEDES ANAYA",
    taxId: "1045697508",
    dv: "5",
    address: "Calle 18B # 17F - 24",
    city: "Barranquilla",
    phone: "3022243805",
    email: "castroycespedes@gmail.com",
    website: "https://paginawebcastroycespedes.netlify.app/",
    logoDataUrl: null,
  },
  contract: { number: "MCC-2026-00003", status: "ACTIVE", startDate: "2026-10-08", endDate: null, planName: "Plan vigencia 2026", tenantName: "CARIBBEAN BEER LICORES SAS", ...overrides },
  account: {
    legalName: "CARIBBEAN BEER LICORES SAS",
    taxIdType: "NIT",
    taxId: "902067003",
    dv: null,
    billingEmail: "cliente@caribbean.co",
    contactName: null,
    contactPhone: null,
    address: null,
    city: null,
  },
  version: {
    versionNo: 2,
    effectiveFrom: "2026-11-09",
    effectiveTo: null,
    termPhase: "INITIAL",
    billingFrequency: "ANNUAL",
    billingAnchorDay: 8,
    trialEndsOn: "2026-11-08",
    prorationPolicy: "DAILY",
    taxName: "IVA 19%",
    taxRate: "0.1900",
    pricesIncludeTax: true,
    includedPosTerminals: 1,
    contractedPosTerminals: 2,
    items: [
      { itemType: "BASE", description: "Plan MANUS POS, término inicial (anual)", quantity: "1.00", unitAmount: "850000.00", billingFrequency: "ANNUAL", discountAmount: "0.00" },
      { itemType: "EXTRA_POS_TERMINAL", description: "Terminal POS adicional (anual)", quantity: "1.00", unitAmount: "350000.00", billingFrequency: "ANNUAL", discountAmount: "0.00" },
      { itemType: "CERTIFICATION", description: "Certificado de resolución DIAN (incluido)", quantity: "1.00", unitAmount: "119000.00", billingFrequency: "ANNUAL", discountAmount: "119000.00" },
    ],
    totals: { ANNUAL: { subtotal: "1200000.00", base: "1008403.00", tax: "191597.00", total: "1200000.00" } },
    reason: null,
  },
  clauses: DEFAULT_CONTRACT_CLAUSES,
});

const flatten = (node: unknown): string[] => {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (node && typeof node === "object") return Object.values(node as Record<string, unknown>).flatMap(flatten);
  return [];
};

test("contract document has parties, conditions, items, totals, clauses and signatures", () => {
  const doc = buildContractDocument(input());
  const text = flatten(doc.content).join("\n");
  for (const expected of [
    "CONTRATO DE LICENCIA DE USO DE MANUS POS",
    "Contrato MCC-2026-00003 · Versión 2 · Activo · Emitido el 10/11/2026",
    "SIRLEY MAYERLIS CESPEDES ANAYA",
    "NIT 1045697508-5",
    "NIT 902067003",
    "Hasta el 08/11/2026; la facturación inicia ese día",
    "2 contratada(s) (1 incluida(s) en el plan)",
    "IVA 19% incluido en los precios",
    "$850.000",
    "- $119.000",
    "$1.008.403",
    "$1.200.000",
    "PRIMERA – OBJETO",
    "NOVENA – TRATAMIENTO DE DATOS PERSONALES",
    "EL CLIENTE",
  ]) {
    assert.ok(text.includes(expected), `falta: ${expected}`);
  }
  assert.equal("watermark" in doc, false);
  assert.equal((doc.defaultStyle as any).font, "Helvetica");
});

test("draft contracts carry the BORRADOR watermark", () => {
  assert.equal((buildContractDocument(input({ status: "DRAFT" })).watermark as any).text, "BORRADOR");
});

test("terms file parsing, fallback and payment instructions", () => {
  const parsed = parseContractTerms("## Objeto\nLinea uno\ncontinua.\n\nSegundo parrafo.\n\n## Vacía\n\n## Pago\n{{instrucciones_pago}}\n");
  assert.deepEqual(parsed, [
    { title: "Objeto", paragraphs: ["Linea uno continua.", "Segundo parrafo."] },
    { title: "Pago", paragraphs: ["{{instrucciones_pago}}"] },
  ]);
  assert.equal(loadContractTerms({ CONTROL_CENTER_CONTRACT_TERMS_FILE: "no-existe.txt" }), DEFAULT_CONTRACT_CLAUSES);
  assert.equal(loadContractTerms({}), DEFAULT_CONTRACT_CLAUSES);
  const withPayment = applyPaymentInstructions(parsed, "Bancolombia 123\nNequi 300");
  assert.equal(withPayment[1].paragraphs[0], "Medios de pago: Bancolombia 123 · Nequi 300");
  assert.equal(applyPaymentInstructions(parsed, null)[1].paragraphs.length, 0);
});

test("helpers: file name, rate and embedded logo only", () => {
  assert.equal(contractPdfFileName("MCC-2026-00003", 2), "MCC-2026-00003-v2.pdf");
  assert.equal(formatRate("0.1900"), "19%");
  assert.equal(formatRate("0.0500"), "5%");
  assert.equal(taxLabel("IVA 19%", "0.1900"), "IVA 19%");
  assert.equal(taxLabel("IVA", "0.1900"), "IVA 19%");
  assert.equal(embeddedLogo("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(embeddedLogo("https://cdn.example.com/logo.png"), null);
  assert.equal(embeddedLogo("data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(embeddedLogo(null), null);
});
