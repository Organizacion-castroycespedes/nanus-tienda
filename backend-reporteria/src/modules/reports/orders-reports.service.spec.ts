import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { OrdersReportsService } from "./orders-reports.service";

test("OrdersReportsService construye XLSX real con venta generada y estados", async () => {
  const service = new OrdersReportsService(null as never, null as never, null as never, null as never);
  const buffer = await (service as any).buildOrderSalesExcel({
    filters: { tenantId: "tenant-1", branchId: "branch-1", dateFrom: "2026-09-01T00:00:00.000Z", dateTo: "2026-09-21T00:00:00.000Z", actorRole: "USER" },
    summary: { count: 1, total: 10, paid: 5, balance: 5, completed: 0, partial: 1, pending: 0 },
    branding: { tenantName: "Tenant Real", legalName: "Empresa Real", nit: null, dv: null, taxResponsibilities: null, regime: null, vatResponsibility: null, address: null, city: null, department: null, country: null, phone: null, email: null, website: null, logo: null, branchName: "Sucursal", branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null },
    rows: [{ orderId: "order-1", date: "2026-09-20T10:00:00.000Z", customerName: "Cliente", total: 10, paid: 5, balance: 5, status: "PARTIAL", paymentStatus: "PARTIAL", branchId: "branch-1", branchName: "Sucursal", generatedSaleId: "sale-1" }],
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Pedidos");
  assert.ok(sheet);
  assert.equal(sheet.columnCount, 10);
  assert.equal(sheet.getRow(2).getCell(4).value, "sale-1");
  assert.equal(sheet.getRow(2).getCell(6).value, 10);
  assert.ok(sheet.getRow(2).getCell(1).value instanceof Date);
});
