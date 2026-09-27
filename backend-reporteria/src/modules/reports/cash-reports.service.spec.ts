import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { CashReportsService } from "./cash-reports.service";

const branding = {
  tenantName: "Tenant Real", legalName: "Empresa Real", nit: "900123456", dv: null,
  taxResponsibilities: null, regime: null, vatResponsibility: null, address: "Calle 1",
  city: null, department: null, country: null, phone: "3000000000", email: "correo@real.co",
  website: null, logo: null, branchName: "Sucursal Centro", branchAddress: null,
  branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null,
};

const rows = [{
  cashSessionId: "session-1", openedAt: "2026-09-20T10:00:00Z", closedAt: null, status: "CLOSED",
  tenantName: "Tenant Real", branchId: "branch-1", branchName: "Sucursal Centro", cashRegister: "Caja 1",
  cashRegisterCode: "C1", terminal: "Terminal 1", openedBy: "open@real.co", closedBy: "close@real.co",
  openingAmount: 10, totalIn: 20, totalOut: 5, expectedAmount: 25, closingAmount: 25, difference: 0,
}];

const auditRows = [{
  cashCountId: "count-1", cashSessionId: "session-1", branchId: "branch-1", branchName: "Sucursal Centro",
  cashRegister: "Caja 1", terminal: "Terminal 1", countedAt: "2026-09-20T10:00:00Z", countedAmount: 100,
  expectedAmount: 90, difference: 10, countedByUserId: "user-1", countedBy: "user@real.co", notes: null,
  sessionStatus: "CLOSED", openedAt: "2026-09-20T08:00:00Z", closedAt: "2026-09-20T12:00:00Z",
}];

const serviceWith = (
  pdfEngine: { generatePdf: (definition: unknown) => Promise<Buffer> },
  collectedRows: unknown[] = rows,
) => new CashReportsService(
  { getPrintableCompany: async () => branding } as never,
  pdfEngine as never,
  { collect: async () => collectedRows } as never,
);

test("CashReportsService construye workbooks reales de Cierres y Arqueos", async () => {
  const service = serviceWith({ generatePdf: async () => Buffer.from("pdf") });
  const closingDataset = {
    branding,
    filters: { tenantId: "tenant-1", branchId: "branch-1", dateFrom: null, dateTo: null, actorRole: "USER" },
    rows,
    summary: { count: 1, openingAmount: 10, totalIn: 20, totalOut: 5, expectedAmount: 25, closingAmount: 25, difference: 0 },
  };
  const auditDataset = {
    branding,
    filters: { tenantId: "tenant-1", branchId: "branch-1", dateFrom: null, dateTo: null, actorRole: "USER" },
    rows: auditRows,
    summary: { count: 1, countedAmount: 100, expectedAmount: 90, difference: 10 },
  };

  const closingXlsx = await (service as any).buildCashClosingsExcel(closingDataset);
  const auditXlsx = await (service as any).buildCashAuditsExcel(auditDataset);
  assert.equal(Buffer.isBuffer(closingXlsx), true);
  assert.equal(Buffer.isBuffer(auditXlsx), true);
  assert.ok(closingXlsx.length > 100);
  assert.ok(auditXlsx.length > 100);

  const closingWorkbook = new ExcelJS.Workbook();
  await closingWorkbook.xlsx.load(closingXlsx);
  assert.equal(closingWorkbook.getWorksheet("Cierres")?.columnCount, 14);
  assert.equal(typeof closingWorkbook.getWorksheet("Cierres")?.getCell("H2").value, "number");
  assert.match(String(closingWorkbook.getWorksheet("Cierres")?.getCell("A2").value), /America\/Bogota/);

  const auditWorkbook = new ExcelJS.Workbook();
  await auditWorkbook.xlsx.load(auditXlsx);
  assert.equal(auditWorkbook.getWorksheet("Arqueos")?.columnCount, 10);
  assert.equal(typeof auditWorkbook.getWorksheet("Arqueos")?.getCell("F2").value, "number");
  assert.match(String(auditWorkbook.getWorksheet("Arqueos")?.getCell("A2").value), /America\/Bogota/);
});

test("CashReportsService PDF no ejecuta renderer Excel en Cierres ni Arqueos", async () => {
  const service = serviceWith({ generatePdf: async () => Buffer.from("pdf") });
  (service as any).buildCashClosingsExcel = async () => { throw new Error("Excel renderer must not run for PDF"); };
  (service as any).buildCashAuditsExcel = async () => { throw new Error("Excel renderer must not run for PDF"); };
  const user = { id: "user-1", tenantId: "tenant-1", branchId: "branch-1", roles: ["USER"] };
  const pdf = await service.getCashClosingsPdf({ tenantId: "tenant-1" }, user as never);
  assert.deepEqual(pdf, Buffer.from("pdf"));
  const auditService = serviceWith({ generatePdf: async () => Buffer.from("pdf") }, auditRows);
  (auditService as any).buildCashAuditsExcel = async () => { throw new Error("Excel renderer must not run for PDF"); };
  const auditPdf = await auditService.getCashAuditsPdf({ tenantId: "tenant-1" }, user as never);
  assert.deepEqual(auditPdf, Buffer.from("pdf"));
});

test("CashReportsService XLSX no ejecuta renderer PDF", async () => {
  const service = serviceWith({ generatePdf: async () => { throw new Error("PDF renderer must not run for Excel"); } });
  const user = { id: "user-1", tenantId: "tenant-1", branchId: "branch-1", roles: ["USER"] };
  const closingXlsx = await service.getCashClosingsExcel({ tenantId: "tenant-1" }, user as never);
  assert.ok(closingXlsx.length > 100);
  const auditService = serviceWith({ generatePdf: async () => { throw new Error("PDF renderer must not run for Excel"); } }, auditRows);
  const auditXlsx = await auditService.getCashAuditsExcel({ tenantId: "tenant-1" }, user as never);
  assert.ok(auditXlsx.length > 100);
});

test("CashReportsService USER keeps only own cash audits and recalculates totals", async () => {
  const adapter = {
    getCashAuditList: async () => ({
      filters: { tenantId: "tenant-1", branchId: "branch-1", dateFrom: null, dateTo: null, actorRole: "USER" },
      rows: [auditRows[0], { ...auditRows[0], cashCountId: "count-2", countedByUserId: "other-user", countedAmount: 900, expectedAmount: 800, difference: 100 }],
      summary: { count: 2, countedAmount: 1000, expectedAmount: 890, difference: 110 },
    }),
  };
  const service = new CashReportsService(adapter as never, {} as never, {} as never);

  const result = await service.getCashAudits(
    { tenantId: "tenant-1" },
    { id: "user-1", tenantId: "tenant-1", branchId: "branch-1", roles: ["USER"] } as never,
  );

  assert.deepEqual(result.rows.map((row) => row.cashCountId), ["count-1"]);
  assert.deepEqual(result.summary, { count: 1, countedAmount: 100, expectedAmount: 90, difference: 10 });
});

test("CashReportsService USER can build PDF for own cash audit ticket", async () => {
  const ticket = {
    header: {
      cashCountId: "count-1", cashSessionId: "session-1", tenantName: "Tenant Real",
      branchId: "branch-1", branchName: "Sucursal Centro", cashRegisterId: "register-1",
      cashRegister: "Caja 1", cashRegisterCode: "C1", terminalId: "terminal-1",
      terminal: "Terminal 1", sessionStatus: "CLOSED", openedAt: "2026-09-20T08:00:00Z",
      closedAt: "2026-09-20T12:00:00Z", openedByUserId: "user-1", openedBy: "user@real.co",
      closedByUserId: "user-1", closedBy: "user@real.co", countedAt: "2026-09-20T10:00:00Z",
      countedByUserId: "user-1", countedBy: "user@real.co",
    },
    audit: { countedAmount: "100", expectedAmount: "90", difference: "10", notes: null },
    sessionTotals: { openingAmount: "10", posSalesPayments: "80", orderSalesPayments: "0", refundPayments: "0", expectedAmount: "90" },
  };
  const calls: unknown[] = [];
  const service = new CashReportsService(
    { getCashAuditTicket: async () => ticket } as never,
    { generatePdf: async (definition: unknown) => { calls.push(definition); return Buffer.from("pdf"); } } as never,
    {} as never,
  );

  const pdf = await service.getCashAuditTicketPdf(
    "count-1",
    { id: "user-1", tenantId: "tenant-1", branchId: "branch-1", roles: ["USER"] } as never,
  );

  assert.deepEqual(pdf, Buffer.from("pdf"));
  assert.equal(calls.length, 1);
});

test("CashReportsService USER blocks PDF for another user's cash audit ticket", async () => {
  const service = new CashReportsService(
    { getCashAuditTicket: async () => ({ header: { countedByUserId: "other-user" } }) } as never,
    { generatePdf: async () => { throw new Error("PDF renderer must not run"); } } as never,
    {} as never,
  );

  await assert.rejects(
    () => service.getCashAuditTicketPdf(
      "count-1",
      { id: "user-1", tenantId: "tenant-1", branchId: "branch-1", roles: ["USER"] } as never,
    ),
    /No autorizado para este arqueo/,
  );
});
