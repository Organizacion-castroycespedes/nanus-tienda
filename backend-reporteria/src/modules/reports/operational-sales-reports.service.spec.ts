import test from "node:test";
import assert from "node:assert/strict";
import { OperationalSalesReportsService } from "./operational-sales-reports.service";
import type { ReportUser } from "../auth/report-auth.types";

const actor: ReportUser = { id: "10000000-0000-0000-0000-000000000001", tenantId: "20000000-0000-0000-0000-000000000001", roles: ["USER"], branchId: null, sessionId: "30000000-0000-0000-0000-000000000001" };
const branding = { tenantName: "QA", legalName: "QA", nit: null, dv: null, taxResponsibilities: null, regime: null, vatResponsibility: null, address: null, city: null, department: null, country: null, phone: null, email: null, website: null, logo: null, branchName: null, branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null };
const row = { id: "40000000-0000-0000-0000-000000000001", createdAt: "2026-01-01T10:00:00.000Z", status: "CONFIRMED", saleType: "SALE", paymentStatus: "PAID", total: 100, customerName: "Cliente", branchName: "Sucursal", operatorEmail: "qa@test.local", cashSessionId: "50000000-0000-0000-0000-000000000001", electronicBillingStatus: "AMBIGUOUS", electronicDocumentNumber: "F-1", electronicCufe: null, providerStatus: "ACCEPTED" };

const service = () => new OperationalSalesReportsService(
  { resolve: async () => ({ tenantId: actor.tenantId, branchIds: ["60000000-0000-0000-0000-000000000001"], requiresCurrentShift: true }) } as never,
  {} as never,
  { collect: async () => [row] } as never,
  { generatePdf: async () => Buffer.from("%PDF-QA") } as never,
  { getPrintableCompany: async () => branding } as never,
);

test("getPdf builds an operational document after scope resolution", async () => {
  const result = await service().getPdf({ sortBy: "createdAt", sortDirection: "DESC" }, actor, "70000000-0000-0000-0000-000000000001");
  assert.equal(result.subarray(0, 5).toString(), "%PDF-");
});

test("getExcel returns an XLSX package after scope resolution", async () => {
  const result = await service().getExcel({ sortBy: "total", sortDirection: "ASC" }, actor, "70000000-0000-0000-0000-000000000001");
  assert.equal(result.subarray(0, 2).toString(), "PK");
});
