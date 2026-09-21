import assert from "node:assert/strict";
import test from "node:test";
import { buildOrderSalesReportLayout } from "./order-sales-report.template";

test("Pedidos PDF usa branding, venta generada y filas indivisibles", () => {
  const definition = buildOrderSalesReportLayout({
    filters: { tenantId: "tenant-1", branchId: "branch-1", dateFrom: null, dateTo: null, actorRole: "USER" },
    summary: { count: 1, total: 10, paid: 5, balance: 5, completed: 0, partial: 1, pending: 0 },
    branding: { tenantName: "Tenant Real", legalName: "Empresa Real", nit: "900", dv: null, taxResponsibilities: null, regime: null, vatResponsibility: null, address: "Calle 1", city: null, department: null, country: null, phone: null, email: null, website: null, logo: "data:image/png;base64,iVBORw0KGgo=", branchName: "Sucursal Real", branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null },
    rows: [{ orderId: "order-1", date: "2026-09-20T10:00:00.000Z", customerName: "Cliente", total: 10, paid: 5, balance: 5, status: "PARTIAL", paymentStatus: "PARTIAL", branchId: "branch-1", branchName: "Sucursal Real", generatedSaleId: "sale-1" }],
  });
  assert.equal(definition.pageOrientation, "landscape");
  const table = (definition.content as any[])[3].table;
  assert.equal(table.headerRows, 1);
  assert.equal(table.dontBreakRows, true);
  assert.equal(table.keepWithHeaderRows, 1);
  assert.equal(table.body[0].length, 7);
  assert.equal((definition.content as any[])[0].columns[0].image, "data:image/png;base64,iVBORw0KGgo=");
});

test("Pedidos PDF deja fallback limpio cuando no existe logo", () => {
  const definition = buildOrderSalesReportLayout({ filters: { tenantId: "tenant-1", branchId: null, dateFrom: null, dateTo: null, actorRole: "USER" }, summary: { count: 0, total: 0, paid: 0, balance: 0, completed: 0, partial: 0, pending: 0 }, rows: [], branding: { tenantName: "Tenant Real", legalName: "Tenant Real", nit: null, dv: null, taxResponsibilities: null, regime: null, vatResponsibility: null, address: null, city: null, department: null, country: null, phone: null, email: null, website: null, logo: null, branchName: null, branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null } });
  assert.equal((definition.content as any[])[0].columns[0].text, "");
});
