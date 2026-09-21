import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { CustomersReportsService } from "./customers-reports.service";

test("Customer master document filter uses normalized fiscal identity input", () => {
  const service = new CustomersReportsService(null as never, null as never, null as never, null as never, null as never);
  assert.equal((service as any).normalizeCustomerDocument("  31-900.654  "), "31900654");
  assert.equal((service as any).normalizeCustomerDocument("   "), undefined);
});

test("Customer master XLSX is serializable and contains fiscal columns without metadata", async () => {
  const service = new CustomersReportsService(null as never, null as never, null as never, null as never, null as never);
  const buffer = await (service as any).buildCustomerMasterExcel({
    filters: { tenantId: "tenant-1", customerDocument: null, customerName: null, actorRole: "ADMIN" },
    summary: { count: 1 },
    branding: { tenantName: "Tenant", legalName: "Empresa", nit: null, dv: null, taxResponsibilities: null, regime: null, vatResponsibility: null, address: null, city: null, department: null, country: null, phone: null, email: null, website: null, logo: null, branchName: null, branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null, branchPhone: null, branchEmail: null },
    rows: [{ customerId: "customer-1", tenantId: "tenant-1", name: "Cliente", documentNumber: "900", documentTypeCode: "31", documentNumberNormalized: "900", dianIdentificationType: "31", identificationNumber: "900", verificationDigit: null, legalName: "Cliente", tradeName: null, phone: null, email: null, fiscalEmail: null, invoiceEmail: null, address: null, city: null, department: null, country: null, countryCode: null, departmentCode: null, municipalityCode: null, personType: null, taxRegime: null, taxResponsibilities: ["R-99-PN"], isDianValidated: false, fiscalDataSource: "MANUAL", fiscalStatus: "PENDING", dianLastLookupAt: null, dianLastLookupStatus: null, isActive: true, isFinalConsumer: false, createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z" }],
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Clientes");
  assert.ok(sheet);
  assert.equal(sheet.getRow(1).getCell(1).value, "Cliente ID");
  assert.equal(sheet.getRow(1).getCell(22).value, "Responsabilidades");
});
