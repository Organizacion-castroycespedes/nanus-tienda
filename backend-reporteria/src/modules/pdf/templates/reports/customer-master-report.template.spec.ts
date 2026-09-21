import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerMasterReportLayout } from "./customer-master-report.template";

const branding = {
  tenantName: "Tenant Real", legalName: "Empresa Real", nit: "900", dv: null,
  taxResponsibilities: null, regime: null, vatResponsibility: null, address: "Calle 1",
  city: "Bogotá", department: null, country: "Colombia", phone: null, email: null,
  website: null, logo: "data:image/png;base64,iVBORw0KGgo=", branchName: null,
  branchAddress: null, branchCity: null, branchDepartment: null, branchCountry: null,
  branchPhone: null, branchEmail: null,
};

test("Customer master PDF has branding, compact columns and indivisible rows", () => {
  const definition = buildCustomerMasterReportLayout({
    filters: { tenantId: "tenant-1", customerDocument: "900", customerName: null, actorRole: "ADMIN" },
    summary: { count: 1 }, branding,
    rows: [{ customerId: "customer-1", tenantId: "tenant-1", name: "Cliente", documentNumber: "900", documentTypeCode: "31", documentNumberNormalized: "900", dianIdentificationType: "31", identificationNumber: "900", verificationDigit: "1", legalName: "Cliente SAS", tradeName: null, phone: "300", email: "c@example.com", fiscalEmail: null, invoiceEmail: null, address: null, city: "Bogotá", department: null, country: "Colombia", countryCode: "CO", departmentCode: null, municipalityCode: null, personType: "JURIDICA", taxRegime: "ORDINARIO", taxResponsibilities: ["R-99-PN"], isDianValidated: true, fiscalDataSource: "MANUAL", fiscalStatus: "VALIDATED", dianLastLookupAt: null, dianLastLookupStatus: null, isActive: true, isFinalConsumer: false, createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z" }],
  });
  const table = (definition.content as any[])[2].table;
  assert.equal(definition.pageOrientation, "landscape");
  assert.equal(table.headerRows, 1);
  assert.equal(table.dontBreakRows, true);
  assert.equal(table.keepWithHeaderRows, 1);
  assert.equal(table.body[0].length, 7);
  assert.equal((definition.content as any[])[0].columns[0].image, branding.logo);
});

test("Customer master PDF has clean logo fallback", () => {
  const definition = buildCustomerMasterReportLayout({ filters: { tenantId: "tenant-1", customerDocument: null, customerName: null, actorRole: "USER" }, summary: { count: 0 }, branding: { ...branding, logo: null }, rows: [] });
  assert.equal((definition.content as any[])[0].columns[0].text, "");
});
