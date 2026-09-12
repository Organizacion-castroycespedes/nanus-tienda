import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ElectronicInvoicingSuppliersRepository } from "./electronic-invoicing-suppliers.repository";

const tenantId = "tenant-1";

const buildSupplierRow = (overrides: Record<string, unknown> = {}) => ({
  id: "supplier-1",
  tenant_id: tenantId,
  name: "Proveedor QA",
  document_number: "900123456",
  document_type_code: "31",
  document_number_normalized: "900123456",
  dian_identification_type: "31",
  identification_number: "900123456",
  verification_digit: null,
  legal_name: null,
  trade_name: null,
  fiscal_email: null,
  invoice_email: null,
  phone: null,
  address: null,
  country_id: null,
  country_code: null,
  department_code: null,
  municipality_code: null,
  person_type: null,
  tax_regime: null,
  tax_responsibilities: ["R-99-PN"],
  fiscal_status: "PENDING",
  fiscal_provider: null,
  fiscal_data_source: "MANUAL",
  is_dian_validated: false,
  fiscal_last_lookup_at: null,
  fiscal_last_lookup_status: null,
  dian_metadata: {},
  is_active: true,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("ElectronicInvoicingSuppliersRepository", () => {
  it("serializes taxResponsibilities as JSONB array on create", async () => {
    const calls: unknown[][] = [];
    const repository = new ElectronicInvoicingSuppliersRepository({
      query: async (_sql: string, params: unknown[]) => {
        calls.push(params);
        return { rows: [buildSupplierRow()] };
      },
    } as never);

    const supplier = await repository.create({
      id: "supplier-1",
      tenantId,
      name: "Proveedor QA",
      documentNumber: "900123456",
      documentTypeCode: "31",
      documentNumberNormalized: "900123456",
      dianIdentificationType: "31",
      identificationNumber: "900123456",
      taxResponsibilities: ["R-99-PN"],
    });

    assert.equal(calls[0][22], "[\"R-99-PN\"]");
    assert.deepEqual(supplier.taxResponsibilities, ["R-99-PN"]);
  });

  it("serializes taxResponsibilities as JSONB array on update", async () => {
    const calls: unknown[][] = [];
    const repository = new ElectronicInvoicingSuppliersRepository({
      query: async (_sql: string, params: unknown[]) => {
        calls.push(params);
        return { rows: [buildSupplierRow()] };
      },
    } as never);

    await repository.update("supplier-1", tenantId, {
      taxResponsibilities: ["R-99-PN"],
    });

    assert.equal(calls[0][2], "[\"R-99-PN\"]");
  });
});
