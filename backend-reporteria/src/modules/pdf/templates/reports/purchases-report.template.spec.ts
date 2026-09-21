import assert from "node:assert/strict";
import test from "node:test";
import { buildPurchasesReportLayout } from "./purchases-report.template";

test("Compras PDF configura orientación, encabezado repetido y filas indivisibles", () => {
  const definition = buildPurchasesReportLayout({
    filters: { tenantId: "tenant-1", branchId: "branch-1", dateFrom: null, dateTo: null, status: null, actorRole: "USER" },
    summary: { count: 1, activeCount: 1, cancelled: 0, total: 10, totalNoRecibido: 0, paid: 5, balance: 5 },
    branding: { tenantName: "Tenant Real", legalName: "Empresa Real", nit: "900", dv: null, taxResponsibilities: null, regime: null, vatResponsibility: null, address: "Calle 1", city: null, department: null, country: null, phone: null, email: null, website: null, logo: null, branchName: "Sucursal Real", branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null },
    rows: [{ purchaseId: "purchase-1", date: "2026-09-20T10:00:00.000Z", supplierName: "Proveedor", total: 10, totalPedido: 10, totalLiquidado: 10, diferenciaNoRecibida: 0, paid: 5, balance: 5, paymentStatus: "PARTIAL", branchId: "branch-1", branchName: "Sucursal Real", status: "RECEIVED" }],
  });
  assert.equal(definition.pageOrientation, "landscape");
  const table = (definition.content as any[])[3].table;
  assert.equal(table.headerRows, 1);
  assert.equal(table.dontBreakRows, true);
  assert.equal(table.keepWithHeaderRows, 1);
  assert.equal(table.body[0].length, 9);
});

test("Compras PDF usa logo corporativo cuando el branding trae data URI y deja fallback limpio", () => {
  const base64Logo = "data:image/png;base64,iVBORw0KGgo=";
  const dataset = {
    filters: { tenantId: "tenant-1", branchId: null, dateFrom: null, dateTo: null, status: null, actorRole: "USER" },
    summary: { count: 0, total: 0, paid: 0, balance: 0 },
    rows: [],
    branding: { tenantName: "Tenant Real", legalName: "Empresa Real", nit: null, dv: null, taxResponsibilities: null, regime: null, vatResponsibility: null, address: null, city: null, department: null, country: null, phone: null, email: null, website: null, logo: base64Logo, branchName: null, branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null },
  } as any;
  const withLogo = buildPurchasesReportLayout(dataset);
  const header = (withLogo.content as any[])[0];
  assert.equal(header.columns[0].image, base64Logo);
  dataset.branding.logo = null;
  const withoutLogo = buildPurchasesReportLayout(dataset);
  assert.equal((withoutLogo.content as any[])[0].columns[0].text, "");
});
