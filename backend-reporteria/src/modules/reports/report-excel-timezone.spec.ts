import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { SalesReportsService } from "./sales-reports.service";

test("POS Excel keeps Bogotá wall-clock dates, exclusive boundary and identifiers", async () => {
  const service = new SalesReportsService(null as never, null as never, null as never, null as never);
  const buffer = await (service as any).buildSalesExcel({
    filters: {
      tenantId: "tenant-test",
      branchId: "branch-test",
      dateFrom: "2026-09-26T05:00:00.000Z",
      dateTo: "2026-09-27T05:00:00.000Z",
      customerDocument: null,
      actorRole: "ADMIN",
    },
    summary: { count: 2, total: 32000, paid: 32000, balance: 0, cancelled: 0, refunded: 0 },
    rows: [
      { saleId: "sale-a", date: "2026-09-26T05:00:00.000Z", customerName: "A", total: 16000, paid: 16000, balance: 0, status: "CONFIRMED", paymentStatus: "PAID", branchId: "branch-test", cashSessionId: null, billingStatus: "NO_DOCUMENT", billingDocumentNumber: null, billingCufe: null, billingAcceptedAt: null },
      { saleId: "sale-b", date: "2026-09-26T05:00:00.001Z", customerName: "B", total: 16000, paid: 16000, balance: 0, status: "CONFIRMED", paymentStatus: "PAID", branchId: "branch-test", cashSessionId: null, billingStatus: "NO_DOCUMENT", billingDocumentNumber: null, billingCufe: null, billingAcceptedAt: null },
    ],
    branding: { legalName: "Test", tenantName: "Test", nit: null, dv: null, taxResponsibilities: null, regime: null, vatResponsibility: null, address: null, city: null, department: null, country: null, phone: null, email: null, website: null, logo: null, branchName: "Branch", branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null },
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const summary = workbook.getWorksheet("Resumen")!;
  const rows = workbook.getWorksheet("Ventas POS")!;
  const summaryValue = (label: string) => {
    const row = summary.getRows(1, summary.rowCount).find((candidate) => candidate.getCell(1).value === label);
    return row?.getCell(2).value;
  };
  assert.equal(summaryValue("Total"), 32000);
  assert.match(String(summaryValue("Hasta")), /27\/09\/2026/);
  assert.equal(summaryValue("Zona horaria"), "America/Bogota");
  assert.equal(rows.getCell("B2").value, "sale-a");
  assert.match(String(rows.getCell("A2").value), /26\/09\/2026, 00:00:00/);
  assert.match(String(rows.getCell("A2").value), /America\/Bogota/);
  assert.match(String(rows.getCell("A3").value), /00:00:00/);
});
