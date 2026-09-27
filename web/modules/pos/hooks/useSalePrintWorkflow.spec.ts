import assert from "node:assert/strict";
import test from "node:test";
import { executeSalePrintWorkflow, type PdfPreviewConfig } from "./useSalePrintWorkflow";

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
