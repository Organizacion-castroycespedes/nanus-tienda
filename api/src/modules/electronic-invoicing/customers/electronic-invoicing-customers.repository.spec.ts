import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ElectronicInvoicingCustomersRepository } from "./electronic-invoicing-customers.repository";

const tenantId = "tenant-1";

const buildCustomerRow = (overrides: Record<string, unknown> = {}) => ({
  id: "customer-1",
  tenant_id: tenantId,
  name: "Cliente QA",
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
  is_final_consumer: false,
  is_dian_validated: false,
  dian_last_lookup_at: null,
  dian_last_lookup_status: null,
  dian_metadata: {},
  fiscal_data_source: "MANUAL",
  fiscal_status: "PENDING",
  is_active: true,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("ElectronicInvoicingCustomersRepository", () => {
  it("serializes taxResponsibilities as JSONB array on create", async () => {
    const calls: unknown[][] = [];
    const repository = new ElectronicInvoicingCustomersRepository({
      query: async (_sql: string, params: unknown[]) => {
        calls.push(params);
        return { rows: [buildCustomerRow()] };
      },
    } as never);

    const customer = await repository.create({
      id: "customer-1",
      tenantId,
      name: "Cliente QA",
      documentNumber: "900123456",
      documentTypeCode: "31",
      documentNumberNormalized: "900123456",
      dianIdentificationType: "31",
      identificationNumber: "900123456",
      taxResponsibilities: ["R-99-PN"],
    });

    assert.equal(calls[0][22], "[\"R-99-PN\"]");
    assert.deepEqual(customer.taxResponsibilities, ["R-99-PN"]);
  });

  it("serializes taxResponsibilities as JSONB array on update", async () => {
    const calls: unknown[][] = [];
    const repository = new ElectronicInvoicingCustomersRepository({
      query: async (_sql: string, params: unknown[]) => {
        calls.push(params);
        return { rows: [buildCustomerRow()] };
      },
    } as never);

    await repository.update("customer-1", tenantId, {
      taxResponsibilities: ["R-99-PN"],
    });

    assert.equal(calls[0][2], "[\"R-99-PN\"]");
  });
});
