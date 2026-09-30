import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { ApiError } from "../../../lib/request";
import { PARAMETER_MODES } from "../../../domains/parameters/api";
import type { ElectronicInvoicePrintDataset } from "../../reporteria/types";
import type { ElectronicBillingOnlineResult } from "../../reporteria/services/electronic-billing.service";
import {
  buildElectronicBillingNotice,
  executeSalePrintWorkflow,
  resolveElectronicBillingOutcome,
  type PdfPreviewConfig,
} from "./useSalePrintWorkflow";

const invoice = (
  status: ElectronicInvoicePrintDataset["status"],
): ElectronicInvoicePrintDataset => ({
  saleId: "sale-12345678-abcd",
  electronicDocumentId: "document-1",
  status,
  documentNumber: status === "ACCEPTED" ? "SETP1" : null,
  cufe: status === "ACCEPTED" ? "cufe-1" : null,
  acceptedAt: status === "ACCEPTED" ? "2026-09-27T08:06:55.471Z" : null,
  providerStatusCode: null,
  providerStatusMessage: null,
  trackingId: null,
  representationAvailable: status === "ACCEPTED",
});

test("executeSalePrintWorkflow opens on-demand ticket preview when billing is disabled", async () => {
  let pdfConfig: PdfPreviewConfig | null = null;
  let isBilling = false;

  await executeSalePrintWorkflow(
    {
      saleId: "sale-12345678-abcd",
      tenantId: null, // fallback defaults to ON_DEMAND
      electronicBillingEnabled: false,
    },
    {
      setPdfConfig: (cfg) => {
        pdfConfig = cfg;
      },
      setIsBillingProcessing: (val) => {
        isBilling = val;
      },
    }
  );

  assert.equal(isBilling, false);
  assert.ok(pdfConfig);
  assert.equal(pdfConfig?.title, "Ticket de venta sale-123");
  assert.equal(pdfConfig?.fileName, "ticket-venta-sale-12345678-abcd.pdf");
  assert.equal(pdfConfig?.allowPrint, true);
});

test("executeSalePrintWorkflow opens on-demand ticket preview when billing mode is ON_DEMAND", async () => {
  let pdfConfig: PdfPreviewConfig | null = null;
  let isBilling = false;

  await executeSalePrintWorkflow(
    {
      saleId: "sale-12345678-abcd",
      tenantId: null,
      electronicBillingEnabled: true,
      electronicBillingMode: PARAMETER_MODES.ON_DEMAND,
    },
    {
      setPdfConfig: (cfg) => {
        pdfConfig = cfg;
      },
      setIsBillingProcessing: (val) => {
        isBilling = val;
      },
    }
  );

  assert.equal(isBilling, false);
  assert.ok(pdfConfig);
  assert.equal(pdfConfig?.title, "Ticket de venta sale-123");
  assert.equal(pdfConfig?.fileName, "ticket-venta-sale-12345678-abcd.pdf");
  assert.equal(pdfConfig?.allowPrint, true);
});

const online = (
  status: ElectronicBillingOnlineResult["status"],
  overrides: Partial<ElectronicBillingOnlineResult> = {},
): ElectronicBillingOnlineResult => ({
  status,
  electronicDocumentId: "document-1",
  documentType: "INVOICE",
  fullNumber: status === "ACCEPTED" ? "SETP1" : null,
  cufe: status === "ACCEPTED" ? "cufe-1" : null,
  cude: null,
  failureClass: null,
  errorCode: null,
  errorMessage: null,
  failures: [],
  message: "",
  ...overrides,
});

test("resolveElectronicBillingOutcome uses the sale response and reads the accepted invoice once", async () => {
  let requestCalls = 0;
  let loadCalls = 0;

  const result = await resolveElectronicBillingOutcome(
    "sale-12345678-abcd",
    online("ACCEPTED"),
    {},
    {
      request: async () => {
        requestCalls += 1;
        throw new Error("should not request again");
      },
      loadInvoice: async () => {
        loadCalls += 1;
        return invoice("ACCEPTED");
      },
    },
  );

  assert.equal(result.online.status, "ACCEPTED");
  assert.equal(result.invoice?.status, "ACCEPTED");
  assert.equal(requestCalls, 0);
  assert.equal(loadCalls, 1);
});

test("resolveElectronicBillingOutcome does not poll rejected or queued documents", async () => {
  let loadCalls = 0;
  const dependencies = {
    request: async () => {
      throw new Error("should not request again");
    },
    loadInvoice: async () => {
      loadCalls += 1;
      return invoice("PENDING");
    },
  };

  const rejected = await resolveElectronicBillingOutcome(
    "sale-12345678-abcd",
    online("REJECTED", { errorCode: "FAK61" }),
    {},
    dependencies,
  );
  const queued = await resolveElectronicBillingOutcome(
    "sale-12345678-abcd",
    online("QUEUED_NETWORK"),
    {},
    dependencies,
  );

  assert.equal(rejected.online.status, "REJECTED");
  assert.equal(queued.online.status, "QUEUED_NETWORK");
  assert.equal(loadCalls, 0);
});

test("resolveElectronicBillingOutcome requests billing when the sale response has no outcome", async () => {
  const requested = await resolveElectronicBillingOutcome(
    "sale-12345678-abcd",
    null,
    {},
    {
      request: async () => ({
        saleId: "sale-12345678-abcd",
        result: "REQUESTED",
        eligibility: "ELIGIBLE",
        requestCreated: true,
        electronicDocumentId: null,
        electronicBilling: online("ACCEPTED"),
      }),
      loadInvoice: async () => {
        throw new ApiError("electronic document not found for sale", 404);
      },
    },
  );
  const existing = await resolveElectronicBillingOutcome(
    "sale-12345678-abcd",
    null,
    {},
    {
      request: async () => ({
        saleId: "sale-12345678-abcd",
        result: "DOCUMENT_EXISTS",
        eligibility: "INELIGIBLE",
        requestCreated: false,
        electronicDocumentId: null,
      }),
      loadInvoice: async () => invoice("ACCEPTED"),
    },
  );

  assert.equal(requested.online.status, "ACCEPTED");
  assert.equal(requested.invoice, null);
  assert.equal(existing.online.status, "ACCEPTED");
  assert.equal(existing.online.fullNumber, "SETP1");
});

test("resolveElectronicBillingOutcome aborts before issuing a request", async () => {
  const controller = new AbortController();
  controller.abort();
  let requestCalls = 0;

  await assert.rejects(
    () => resolveElectronicBillingOutcome(
      "sale-12345678-abcd",
      null,
      { signal: controller.signal },
      {
        request: async () => {
          requestCalls += 1;
          throw new Error("unexpected");
        },
        loadInvoice: async () => invoice("PENDING"),
      },
    ),
    (error: unknown) => error instanceof Error && error.name === "AbortError",
  );
  assert.equal(requestCalls, 0);
});

test("buildElectronicBillingNotice shows the rejection code and solution", () => {
  const notice = buildElectronicBillingNotice(online("REJECTED", {
    errorCode: "FAK61",
    failures: [{
      code: "FAK61",
      message: "Regla: FAK61",
      origin: "DIAN",
      path: null,
      severity: "REJECTION",
      title: "Correo del adquiriente",
      solution: "Registrar un correo válido del cliente.",
      retryable: false,
    }],
  }));

  assert.equal(notice?.variant, "error");
  assert.match(notice?.message ?? "", /\[FAK61\]/);
  assert.match(notice?.message ?? "", /Solución: Registrar un correo válido del cliente\./);
  assert.equal(buildElectronicBillingNotice(online("ACCEPTED")), null);
  assert.equal(buildElectronicBillingNotice(online("QUEUED_NETWORK"))?.variant, "warning");
});

test("POS billing wait dialog cannot be dismissed while the invoice is being sent", () => {
  const source = readFileSync(
    resolve(process.cwd(), "modules/pos/components/PosScreen.tsx"),
    "utf8",
  );

  assert.match(source, /isSendingElectronicInvoice \|\| isBillingProcessing/);
  assert.match(source, /<Modal title="Facturación electrónica" size="md">/);
  assert.doesNotMatch(source, /onClose=\{cancelBillingProcessing\}/);
  assert.match(source, /Enviando factura a la DIAN…/);
});
