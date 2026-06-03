import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";
import {
  ElectronicInvoicingCustomersService,
  normalizeFiscalDocument,
} from "./electronic-invoicing-customers.service";
import type {
  ElectronicInvoicingCustomer,
  FiscalDataSource,
  FiscalStatus,
  PersonType,
} from "./electronic-invoicing-customer.types";

const tenantId = "tenant-1";

const buildCustomer = (
  overrides: Partial<ElectronicInvoicingCustomer> = {}
): ElectronicInvoicingCustomer => ({
  id: "customer-1",
  tenantId,
  name: "Cliente Uno",
  documentNumber: "900.123-456",
  documentTypeCode: null,
  documentNumberNormalized: "900123456",
  dianIdentificationType: null,
  identificationNumber: "900123456",
  verificationDigit: null,
  legalName: null,
  tradeName: null,
  fiscalEmail: null,
  invoiceEmail: null,
  phone: null,
  address: null,
  countryCode: null,
  departmentCode: null,
  municipalityCode: null,
  personType: null,
  taxRegime: null,
  taxResponsibilities: [],
  isFinalConsumer: false,
  isDianValidated: false,
  dianLastLookupAt: null,
  dianLastLookupStatus: null,
  dianMetadata: {},
  fiscalDataSource: "MANUAL",
  fiscalStatus: "PENDING",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const buildService = (
  overrides: Partial<{
    customers: ElectronicInvoicingCustomer[];
    duplicateDocument: ElectronicInvoicingCustomer | null;
    duplicateFiscalIdentity: ElectronicInvoicingCustomer | null;
    activeFinalConsumer: ElectronicInvoicingCustomer | null;
  }> = {}
) => {
  const state = {
    customers: overrides.customers ?? [buildCustomer()],
    duplicateDocument: overrides.duplicateDocument ?? null,
    duplicateFiscalIdentity: overrides.duplicateFiscalIdentity ?? null,
    activeFinalConsumer: overrides.activeFinalConsumer ?? null,
  };

  const repository = {
    listByTenant: async () => state.customers,
    findById: async (id: string) =>
      state.customers.find((customer) => customer.id === id) ?? null,
    findByFiscalIdentity: async () => state.duplicateFiscalIdentity,
    findByNormalizedDocument: async () => state.duplicateDocument,
    findActiveFinalConsumer: async (_tenantId: string, excludeId?: string) => {
      if (
        state.activeFinalConsumer &&
        state.activeFinalConsumer.id !== excludeId
      ) {
        return state.activeFinalConsumer;
      }
      return null;
    },
    create: async (input: {
      id: string;
      tenantId: string;
      name: string;
      documentNumber?: string | null;
      documentTypeCode?: string | null;
      documentNumberNormalized?: string | null;
      dianIdentificationType?: string | null;
      identificationNumber?: string | null;
      verificationDigit?: string | null;
      legalName?: string | null;
      tradeName?: string | null;
      fiscalEmail?: string | null;
      invoiceEmail?: string | null;
      phone?: string | null;
      address?: string | null;
      countryCode?: string | null;
      departmentCode?: string | null;
      municipalityCode?: string | null;
      personType?: PersonType | null;
      taxRegime?: string | null;
      taxResponsibilities?: string[];
      isFinalConsumer?: boolean;
      isDianValidated?: boolean;
      dianMetadata?: Record<string, unknown>;
      fiscalDataSource?: FiscalDataSource;
      fiscalStatus?: FiscalStatus;
      isActive?: boolean;
    }) => {
      const customer = buildCustomer({
        id: input.id,
        tenantId: input.tenantId,
        name: input.name,
        documentNumber: input.documentNumber ?? null,
        documentTypeCode: input.documentTypeCode ?? null,
        documentNumberNormalized: input.documentNumberNormalized ?? null,
        dianIdentificationType: input.dianIdentificationType ?? null,
        identificationNumber: input.identificationNumber ?? null,
        verificationDigit: input.verificationDigit ?? null,
        legalName: input.legalName ?? null,
        tradeName: input.tradeName ?? null,
        fiscalEmail: input.fiscalEmail ?? null,
        invoiceEmail: input.invoiceEmail ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        countryCode: input.countryCode ?? null,
        departmentCode: input.departmentCode ?? null,
        municipalityCode: input.municipalityCode ?? null,
        personType: input.personType ?? null,
        taxRegime: input.taxRegime ?? null,
        taxResponsibilities: input.taxResponsibilities ?? [],
        isFinalConsumer: input.isFinalConsumer ?? false,
        isDianValidated: input.isDianValidated ?? false,
        dianMetadata: input.dianMetadata ?? {},
        fiscalDataSource: input.fiscalDataSource ?? "MANUAL",
        fiscalStatus: input.fiscalStatus ?? "PENDING",
        isActive: input.isActive ?? true,
      });
      state.customers.unshift(customer);
      if (customer.isFinalConsumer && customer.isActive) {
        state.activeFinalConsumer = customer;
      }
      return customer;
    },
    update: async (
      id: string,
      _tenantId: string,
      data: Partial<ElectronicInvoicingCustomer>
    ) => {
      const current = state.customers.find((customer) => customer.id === id);
      if (!current) {
        return null;
      }
      Object.assign(current, data, {
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      return current;
    },
  };

  return new ElectronicInvoicingCustomersService(repository as never);
};

describe("ElectronicInvoicingCustomersService", () => {
  it("normalizes document numbers", () => {
    assert.equal(normalizeFiscalDocument(" 900.123-456 "), "900123456");
    assert.equal(normalizeFiscalDocument(" ab-123 "), "AB123");
    assert.equal(normalizeFiscalDocument(" --- "), null);
  });

  it("lists FE customers with filters", async () => {
    const service = buildService();

    const result = await service.listCustomers(tenantId, {
      search: "Cliente",
      isActive: "true",
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].documentNumberNormalized, "900123456");
  });

  it("creates a FE customer with optional fiscal email", async () => {
    const service = buildService({ customers: [] });

    const customer = await service.createCustomer(tenantId, {
      name: "ACME SAS",
      documentNumber: "900.123-456",
      documentTypeCode: "31",
    });

    assert.equal(customer.documentNumberNormalized, "900123456");
    assert.equal(customer.dianIdentificationType, "31");
    assert.equal(customer.identificationNumber, "900123456");
    assert.equal(customer.tradeName, "ACME SAS");
    assert.equal(customer.fiscalEmail, null);
    assert.equal(customer.invoiceEmail, null);
    assert.equal(customer.fiscalDataSource, "MANUAL");
    assert.equal(customer.fiscalStatus, "PENDING");
  });

  it("creates a FE customer with minimum fiscal base fields", async () => {
    const service = buildService({ customers: [] });

    const customer = await service.createCustomer(tenantId, {
      name: "ACME SAS",
      documentNumber: "900.123-456",
      dianIdentificationType: "31",
      invoiceEmail: "FACTURAS@ACME.CO",
      phone: "3001234567",
      address: "CL 1 2 3",
      countryCode: "CO",
      departmentCode: "05",
      municipalityCode: "05001",
      personType: "JURIDICA",
      taxRegime: "ORDINARIO",
      taxResponsibilities: ["R-99-PN"],
      fiscalDataSource: "MANUAL",
      dianMetadata: { source: "manual" },
    });

    assert.equal(customer.documentTypeCode, "31");
    assert.equal(customer.dianIdentificationType, "31");
    assert.equal(customer.invoiceEmail, "facturas@acme.co");
    assert.equal(customer.fiscalEmail, "facturas@acme.co");
    assert.equal(customer.phone, "3001234567");
    assert.equal(customer.address, "CL 1 2 3");
    assert.equal(customer.countryCode, "CO");
    assert.equal(customer.departmentCode, "05");
    assert.equal(customer.municipalityCode, "05001");
    assert.equal(customer.personType, "JURIDICA");
    assert.deepEqual(customer.taxResponsibilities, ["R-99-PN"]);
    assert.deepEqual(customer.dianMetadata, { source: "manual" });
  });

  it("rejects invalid fiscalEmail when provided", async () => {
    const service = buildService({ customers: [] });

    await assert.rejects(
      () =>
        service.createCustomer(tenantId, {
          name: "ACME SAS",
          fiscalEmail: "bad-email",
        }),
      /fiscalEmail is invalid/
    );
  });

  it("rejects duplicated fiscal identity by tenant", async () => {
    const duplicate = buildCustomer({ id: "customer-dup" });
    const service = buildService({ duplicateFiscalIdentity: duplicate });

    await assert.rejects(
      () =>
        service.createCustomer(tenantId, {
          name: "Duplicado",
          documentNumber: "900123456",
          documentTypeCode: "31",
        }),
      /fiscal identity already exists/
    );
  });

  it("allows same number with different document type", async () => {
    const duplicateByNumber = buildCustomer({ id: "customer-dup" });
    const service = buildService({
      customers: [],
      duplicateDocument: duplicateByNumber,
    });

    const customer = await service.createCustomer(tenantId, {
      name: "Mismo numero otro tipo",
      documentNumber: "900123456",
      documentTypeCode: "13",
    });

    assert.equal(customer.documentTypeCode, "13");
    assert.equal(customer.identificationNumber, "900123456");
  });

  it("ensures default final consumer idempotently", async () => {
    const existing = buildCustomer({
      id: "final-1",
      name: "Consumidor Final",
      isFinalConsumer: true,
      fiscalStatus: "NOT_REQUIRED",
    });
    const service = buildService({
      customers: [existing],
      activeFinalConsumer: existing,
    });

    const first = await service.ensureDefaultFinalConsumer(tenantId);
    const second = await service.ensureDefaultFinalConsumer(tenantId);

    assert.equal(first.id, "final-1");
    assert.equal(second.id, "final-1");
  });

  it("creates final consumer without email or document", async () => {
    const service = buildService({ customers: [] });

    const customer = await service.ensureDefaultFinalConsumer(tenantId);

    assert.equal(customer.name, "Consumidor Final");
    assert.equal(customer.documentNumber, null);
    assert.equal(customer.fiscalEmail, null);
    assert.equal(customer.invoiceEmail, null);
    assert.equal(customer.isFinalConsumer, true);
    assert.equal(customer.fiscalStatus, "NOT_REQUIRED");
    assert.equal(customer.isDianValidated, false);
  });

  it("prevents duplicate active final consumer by tenant", async () => {
    const existing = buildCustomer({
      id: "final-1",
      isFinalConsumer: true,
      fiscalStatus: "NOT_REQUIRED",
    });
    const service = buildService({ activeFinalConsumer: existing });

    await assert.rejects(
      () =>
        service.createCustomer(tenantId, {
          isFinalConsumer: true,
        }),
      ConflictException
    );
  });

  it("updates optional fiscal fields", async () => {
    const service = buildService();

    const updated = await service.updateCustomer("customer-1", tenantId, {
      legalName: "ACME SAS",
      fiscalEmail: "FACTURAS@ACME.CO",
      documentNumber: "900-123-456",
      countryCode: "CO",
      personType: "JURIDICA",
      taxResponsibilities: ["O-13"],
    });

    assert.equal(updated.legalName, "ACME SAS");
    assert.equal(updated.fiscalEmail, "facturas@acme.co");
    assert.equal(updated.invoiceEmail, "facturas@acme.co");
    assert.equal(updated.documentNumberNormalized, "900123456");
    assert.equal(updated.identificationNumber, "900123456");
    assert.equal(updated.countryCode, "CO");
    assert.equal(updated.personType, "JURIDICA");
    assert.deepEqual(updated.taxResponsibilities, ["O-13"]);
  });

  it("rejects deactivating final consumer", async () => {
    const finalConsumer = buildCustomer({
      id: "final-1",
      isFinalConsumer: true,
      fiscalStatus: "NOT_REQUIRED",
    });
    const service = buildService({ customers: [finalConsumer] });

    await assert.rejects(
      () =>
        service.updateCustomer("final-1", tenantId, {
          isActive: false,
        }),
      /final consumer cannot be deleted/
    );
  });
});
