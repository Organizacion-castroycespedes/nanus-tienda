import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { ApiError } from "../../../lib/request";
import { PARAMETER_MODES } from "../../../domains/parameters/api";
import type { ElectronicInvoicePrintDataset } from "../../reporteria/types";
import {
  executeSalePrintWorkflow,
  waitForElectronicInvoice,
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

test("waitForElectronicInvoice tolerates the initial 404 and refreshes PROCESSING only once", async () => {
  const responses: Array<ElectronicInvoicePrintDataset | Error> = [
    new ApiError("electronic document not found for sale", 404),
    invoice("PENDING"),
    invoice("PROCESSING"),
    invoice("ACCEPTED"),
  ];
  let refreshCalls = 0;
  let waitCalls = 0;

  const result = await waitForElectronicInvoice(
    "sale-12345678-abcd",
    { maxAttempts: 6, intervalMs: 1 },
    {
      loadInvoice: async () => {
        const next = responses.shift();
        if (next instanceof Error) throw next;
        assert.ok(next);
        return next;
      },
      refreshStatus: async () => {
        refreshCalls += 1;
      },
      wait: async () => {
        waitCalls += 1;
      },
    },
  );

  assert.equal(result?.status, "ACCEPTED");
  assert.equal(refreshCalls, 1);
  assert.equal(waitCalls, 2);
});

test("waitForElectronicInvoice stops at its bound without leaving a final timer", async () => {
  let loadCalls = 0;
  let waitCalls = 0;

  const result = await waitForElectronicInvoice(
    "sale-12345678-abcd",
    { maxAttempts: 2, intervalMs: 1 },
    {
      loadInvoice: async () => {
        loadCalls += 1;
        return invoice("PENDING");
      },
      refreshStatus: async () => undefined,
      wait: async () => {
        waitCalls += 1;
      },
    },
  );

  assert.equal(result?.status, "PENDING");
  assert.equal(loadCalls, 2);
  assert.equal(waitCalls, 1);
});

test("waitForElectronicInvoice aborts before issuing another request", async () => {
  const controller = new AbortController();
  controller.abort();
  let loadCalls = 0;

  await assert.rejects(
    () => waitForElectronicInvoice(
      "sale-12345678-abcd",
      { signal: controller.signal },
      {
        loadInvoice: async () => {
          loadCalls += 1;
          return invoice("PENDING");
        },
        refreshStatus: async () => undefined,
        wait: async () => undefined,
      },
    ),
    (error: unknown) => error instanceof Error && error.name === "AbortError",
  );
  assert.equal(loadCalls, 0);
});

test("POS billing wait dialog closes through the workflow cancellation handler", () => {
  const source = readFileSync(
    resolve(process.cwd(), "modules/pos/components/PosScreen.tsx"),
    "utf8",
  );

  assert.match(source, /cancelBillingProcessing,/);
  assert.match(source, /onClose=\{cancelBillingProcessing\}/);
  assert.doesNotMatch(source, /onClose=\{\(\) => \{\}\}/);
  assert.match(source, /Puede tardar hasta 2 minutos/);
  assert.match(source, /la factura seguirá procesándose/);
});
