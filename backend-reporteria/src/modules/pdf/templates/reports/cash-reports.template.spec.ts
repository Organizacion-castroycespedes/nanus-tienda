import assert from "node:assert/strict";
import test from "node:test";
import { buildCashAuditsReportLayout } from "./cash-audits-report.template";
import { buildCashClosingsReportLayout } from "./cash-closings-report.template";

const branding = {
  tenantName: "Tenant Real", legalName: "Empresa Real", nit: "900123456", dv: null,
  taxResponsibilities: null, regime: null, vatResponsibility: null, address: "Calle 1",
  city: null, department: null, country: null, phone: "3000000000", email: "correo@real.co",
  website: null, logo: null, branchName: "Sucursal Centro", branchAddress: null,
  branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null,
};

test("cash closing PDF repeats headers and keeps rows intact", () => {
  const definition = buildCashClosingsReportLayout({
    branding,
    filters: { tenantId: "tenant-id", branchId: "branch-id", dateFrom: null, dateTo: null, actorRole: "USER" },
    summary: { count: 1, openingAmount: 1, totalIn: 2, totalOut: 1, expectedAmount: 2, closingAmount: 2, difference: 0 },
    rows: [{ cashSessionId: "session-id", openedAt: "2026-09-20T10:00:00Z", closedAt: null, status: "CLOSED", tenantName: "Tenant Real", branchId: "branch-id", branchName: "Sucursal Centro", cashRegister: "Caja 1", cashRegisterCode: "C1", terminal: "Terminal 1", openedBy: "open@real.co", closedBy: "close@real.co", openingAmount: 1, totalIn: 2, totalOut: 1, expectedAmount: 2, closingAmount: 2, difference: 0 }],
  });
  const table = (definition.content as Array<{ table?: { headerRows?: number; dontBreakRows?: boolean; keepWithHeaderRows?: number } }>).find((item) => item.table?.headerRows === 1)?.table;
  assert.equal(table?.headerRows, 1);
  assert.equal(table?.dontBreakRows, true);
  assert.equal(table?.keepWithHeaderRows, 1);
  assert.match(JSON.stringify(definition), /Sucursal Centro/);
  assert.doesNotMatch(JSON.stringify(definition), /Tenant: tenant-id/);
});

test("cash audit PDF keeps its own table definition and readable scope", () => {
  const definition = buildCashAuditsReportLayout({
    branding,
    filters: { tenantId: "tenant-id", branchId: "branch-id", dateFrom: null, dateTo: null, actorRole: "USER" },
    summary: { count: 1, countedAmount: 100, expectedAmount: 90, difference: 10 },
    rows: [{ cashCountId: "count-id", cashSessionId: "session-id", branchId: "branch-id", branchName: "Sucursal Centro", cashRegister: "Caja 1", terminal: "Terminal 1", countedAt: "2026-09-20T10:00:00Z", countedAmount: 100, expectedAmount: 90, difference: 10, countedByUserId: "user-id", countedBy: "usuario@real.co", notes: null, sessionStatus: "CLOSED", openedAt: "2026-09-20T08:00:00Z", closedAt: "2026-09-20T12:00:00Z" }],
  });
  const table = (definition.content as Array<{ table?: { body?: Array<Array<{ text?: string }>>; headerRows?: number; dontBreakRows?: boolean } }>).find((item) => item.table?.headerRows === 1)?.table;
  assert.equal(table?.headerRows, 1);
  assert.equal(table?.dontBreakRows, true);
  assert.equal(table?.body?.[0]?.[0]?.text, "Fecha");
  assert.equal(table?.body?.[0]?.[4]?.text, "Responsable");
});
