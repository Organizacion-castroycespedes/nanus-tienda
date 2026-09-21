import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { PurchasesReportsService } from "./purchases-reports.service";

test("PurchasesReportsService construye un XLSX real con columnas contractuales y tipos", async () => {
  const service = new PurchasesReportsService(null as never, null as never, null as never, null as never);
  const buffer = await (service as any).buildPurchasesExcel({
    filters: { tenantId: "tenant-1", branchId: "branch-1", dateFrom: "2026-09-01T00:00:00.000Z", dateTo: "2026-09-21T00:00:00.000Z", status: "RECEIVED", actorRole: "USER" },
    summary: { count: 1, activeCount: 1, cancelled: 0, total: 10, totalNoRecibido: 0, paid: 5, balance: 5 },
    branding: { tenantName: "Tenant Real", legalName: "Empresa Real", nit: "900", dv: null, taxResponsibilities: null, regime: null, vatResponsibility: null, address: null, city: null, department: null, country: null, phone: null, email: null, website: null, logo: null, branchName: "Sucursal", branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null },
    rows: [{ purchaseId: "purchase-full-id", date: "2026-09-20T10:00:00.000Z", supplierName: "Proveedor", supplierInvoiceNumber: "FAC-100", supplierInvoiceDate: "2026-09-19", total: 10, totalPedido: 12, totalLiquidado: 10, diferenciaNoRecibida: 2, paid: 5, balance: 5, paymentStatus: "PARTIAL", branchId: "branch-1", branchName: "Sucursal", status: "RECEIVED" }],
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Compras");
  assert.ok(sheet);
  assert.equal(sheet.columnCount, 14);
  assert.equal(sheet.getRow(2).getCell(7).value, 10);
  assert.ok(sheet.getRow(2).getCell(1).value instanceof Date);
  assert.equal(sheet.getRow(2).getCell(2).value, "purchase-full-id");
  assert.equal(sheet.getRow(2).getCell(4).value, "FAC-100");
  assert.ok(sheet.getRow(2).getCell(5).value instanceof Date);
});
