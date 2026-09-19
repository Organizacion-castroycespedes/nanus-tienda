import assert from "node:assert/strict";
import test from "node:test";
import { PdfmakeEngine } from "../../pdfmake.engine";
import { buildProductInventoryLayout } from "./product-inventory-report.template";
import type { ProductInventoryDataset } from "../../../reports/product-inventory-reports.service";

test("product inventory layout renders an empty branded landscape PDF", async () => {
  const dataset: ProductInventoryDataset = {
    preset: "GENERAL", generatedAt: "2026-09-16T12:00:00.000Z",
    generatedBy: "admin@example.test",
    tenantId: "00000000-0000-4000-8000-000000000001",
    branchIds: ["30000000-0000-4000-8000-000000000001"],
    branding: { name: "Empresa QA", legalName: "Empresa QA SAS", nit: "123",
      address: "Calle 1", phone: "123", logo: null, primaryColor: "#234567" },
    filters: { stockState: "OUT_OF_STOCK" }, rows: [],
  };
  const definition = buildProductInventoryLayout(dataset);
  assert.equal(definition.pageOrientation, "landscape");
  const buffer = await new PdfmakeEngine().generatePdf(definition);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
});
