import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";
import {
  ElectronicInvoicingCustomersService,
  normalizeFiscalDocument,
} from "./electronic-invoicing-customers.service";
import type {
  ElectronicInvoicingCustomer,
  FiscalStatus,
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
  verificationDigit: null,
  legalName: null,
  fiscalEmail: null,
  isFinalConsumer: false,
  dianLastLookupAt: null,
  dianLastLookupStatus: null,
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
    activeFinalConsumer: ElectronicInvoicingCustomer | null;
  }> = {}
) => {
  const state = {
    customers: overrides.customers ?? [buildCustomer()],
    duplicateDocument: overrides.duplicateDocument ?? null,
    activeFinalConsumer: overrides.activeFinalConsumer ?? null,
  };

  const repository = {
    listByTenant: async () => state.customers,
    findById: async (id: string) =>
      state.customers.find((customer) => customer.id === id) ?? null,
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
      verificationDigit?: string | null;
      legalName?: string | null;
      fiscalEmail?: string | null;
      isFinalConsumer?: boolean;
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
        verificationDigit: input.verificationDigit ?? null,
        legalName: input.legalName ?? null,
        fiscalEmail: input.fiscalEmail ?? null,
        isFinalConsumer: input.isFinalConsumer ?? false,
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
    assert.equal(customer.fiscalEmail, null);
    assert.equal(customer.fiscalStatus, "PENDING");
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

  it("rejects duplicated normalized document by tenant", async () => {
    const duplicate = buildCustomer({ id: "customer-dup" });
    const service = buildService({ duplicateDocument: duplicate });

    await assert.rejects(
      () =>
        service.createCustomer(tenantId, {
          name: "Duplicado",
          documentNumber: "900123456",
        }),
      /documentNumber already exists/
    );
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
    assert.equal(customer.isFinalConsumer, true);
    assert.equal(customer.fiscalStatus, "NOT_REQUIRED");
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
    });

    assert.equal(updated.legalName, "ACME SAS");
    assert.equal(updated.fiscalEmail, "facturas@acme.co");
    assert.equal(updated.documentNumberNormalized, "900123456");
  });
});
