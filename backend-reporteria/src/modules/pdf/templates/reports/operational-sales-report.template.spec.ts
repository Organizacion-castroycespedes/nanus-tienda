import assert from "node:assert/strict";
import test from "node:test";
import { PdfmakeEngine } from "../../pdfmake.engine";
import {
  buildOperationalSalesReportLayout,
  OPERATIONAL_SALES_PAGE_MARGINS,
  OPERATIONAL_SALES_TABLE_CELL_PADDING,
  OPERATIONAL_SALES_TABLE_WIDTHS,
} from "./operational-sales-report.template";
import type { OperationalSalesReportDataset } from "../../../reports/types/operational-sales-report.types";

const dataset = (logo: string | null): OperationalSalesReportDataset => ({
  query: {},
  branding: {
    tenantName: "Empresa QA",
    legalName: "Empresa QA SAS",
    nit: "900123456",
    dv: "7",
    taxResponsibilities: null,
    regime: null,
    vatResponsibility: null,
    address: "Calle 1 # 2-3",
    city: "Bogota",
    department: "Cundinamarca",
    country: "Colombia",
    phone: "3000000000",
    email: "qa@empresa.test",
    website: null,
    logo,
    branchName: "Sucursal Principal",
    branchAddress: null,
    branchCity: null,
    branchDepartment: null,
    branchCountry: null,
    branchPhone: null,
    branchEmail: null,
  },
  rows: Array.from({ length: 80 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    createdAt: "2026-09-23T10:00:00.000Z",
    status: "CONFIRMED",
    saleType: "SALE",
    paymentStatus: "PAID",
    total: 987654321.99,
    customerName: "Cliente con un nombre muy largo para comprobar el wrapping interno",
    branchName: "Sucursal Principal",
    operatorEmail: "operator@empresa.test",
    cashSessionId: null,
    electronicBillingStatus: "TECHNICAL_ERROR",
    electronicDocumentNumber: "FV-2026-000000123456789",
    electronicCufe: null,
    providerStatus: "PROCESSING",
  })),
});

test("operational sales PDF uses corporate logo and a bounded eight-column table", async () => {
  const logo = "data:image/svg+xml;base64," + Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\"><rect width=\"20\" height=\"20\" fill=\"#123456\"/></svg>").toString("base64");
  const definition = buildOperationalSalesReportLayout(dataset(logo));
  const header = definition.content[0] as { columns: Array<{ image?: string; svg?: string }> };
  const table = definition.content[2] as { table: { widths: readonly number[]; headerRows: number; dontBreakRows: boolean; keepWithHeaderRows: number; body: unknown[] } };

  assert.equal(definition.pageSize, "A4");
  assert.equal(definition.pageOrientation, "landscape");
  assert.deepEqual(definition.pageMargins, OPERATIONAL_SALES_PAGE_MARGINS);
  assert.equal(header.columns[0].svg?.includes("<svg"), true);
  assert.equal(table.table.widths.length, 8);
  const declaredWidth = table.table.widths.reduce((sum, width) => sum + width, 0);
  const effectiveWidth = declaredWidth + table.table.widths.length * 2 * OPERATIONAL_SALES_TABLE_CELL_PADDING;
  assert.equal(declaredWidth, 755);
  assert.equal(effectiveWidth, 771);
  assert.ok(effectiveWidth <= 841.89 - OPERATIONAL_SALES_PAGE_MARGINS[0] - OPERATIONAL_SALES_PAGE_MARGINS[2] - 10);
  assert.equal(table.table.headerRows, 1);
  assert.equal(table.table.dontBreakRows, true);
  assert.equal(table.table.keepWithHeaderRows, 1);

  const buffer = await new PdfmakeEngine().generatePdf(definition);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
});

test("operational sales PDF keeps a valid fallback when branding has no logo", () => {
  const definition = buildOperationalSalesReportLayout(dataset(null));
  const header = definition.content[0] as { columns: Array<{ text?: string }> };
  assert.equal(header.columns[0].text, "");
});
