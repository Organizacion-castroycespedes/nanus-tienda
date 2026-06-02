import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type {
  ElectronicInvoicingSupplier,
  SupplierFiscalStatus,
} from "./electronic-invoicing-supplier.types";
import {
  ElectronicInvoicingSuppliersService,
  normalizeSupplierFiscalDocument,
} from "./electronic-invoicing-suppliers.service";

const tenantId = "tenant-1";
const otherTenantId = "tenant-2";

const buildSupplier = (
  overrides: Partial<ElectronicInvoicingSupplier> = {}
): ElectronicInvoicingSupplier => ({
  id: "supplier-1",
  tenantId,
  name: "Proveedor Uno",
  documentNumber: "900.123-456",
  documentTypeCode: null,
  documentNumberNormalized: "900123456",
  verificationDigit: null,
  legalName: null,
  fiscalEmail: null,
  fiscalStatus: "PENDING",
  fiscalProvider: null,
  fiscalLastLookupAt: null,
  fiscalLastLookupStatus: null,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const buildService = (
  overrides: Partial<{
    suppliers: ElectronicInvoicingSupplier[];
    duplicateDocument: ElectronicInvoicingSupplier | null;
  }> = {}
) => {
  const state = {
    suppliers: overrides.suppliers ?? [buildSupplier()],
    duplicateDocument: overrides.duplicateDocument ?? null,
    purchaseRowsTouched: false,
  };

  const repository = {
    listByTenant: async () => state.suppliers,
    findById: async (id: string, requestedTenantId: string) =>
      state.suppliers.find(
        (supplier) =>
          supplier.id === id && supplier.tenantId === requestedTenantId
      ) ?? null,
    findByNormalizedDocument: async () => state.duplicateDocument,
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
      fiscalStatus?: SupplierFiscalStatus;
      fiscalProvider?: string | null;
      isActive?: boolean;
    }) => {
      const supplier = buildSupplier({
        id: input.id,
        tenantId: input.tenantId,
        name: input.name,
        documentNumber: input.documentNumber ?? null,
        documentTypeCode: input.documentTypeCode ?? null,
        documentNumberNormalized: input.documentNumberNormalized ?? null,
        verificationDigit: input.verificationDigit ?? null,
        legalName: input.legalName ?? null,
        fiscalEmail: input.fiscalEmail ?? null,
        fiscalStatus: input.fiscalStatus ?? "PENDING",
        fiscalProvider: input.fiscalProvider ?? null,
        isActive: input.isActive ?? true,
      });
      state.suppliers.unshift(supplier);
      return supplier;
    },
    update: async (
      id: string,
      requestedTenantId: string,
      data: Partial<ElectronicInvoicingSupplier>
    ) => {
      const current = state.suppliers.find(
        (supplier) =>
          supplier.id === id && supplier.tenantId === requestedTenantId
      );
      if (!current) {
        return null;
      }
      Object.assign(current, data, {
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      return current;
    },
  };

  return {
    service: new ElectronicInvoicingSuppliersService(repository as never),
    state,
  };
};

describe("ElectronicInvoicingSuppliersService", () => {
  it("normalizes document numbers", () => {
    assert.equal(normalizeSupplierFiscalDocument(" 900.123-456 "), "900123456");
    assert.equal(normalizeSupplierFiscalDocument(" nit-abc-123 "), "NITABC123");
    assert.equal(normalizeSupplierFiscalDocument(" --- "), null);
  });

  it("lists FE suppliers with filters", async () => {
    const { service } = buildService();

    const result = await service.listSuppliers(tenantId, {
      search: "Proveedor",
      isActive: "true",
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].documentNumberNormalized, "900123456");
  });

  it("creates a FE supplier with optional fiscal email", async () => {
    const { service } = buildService({ suppliers: [] });

    const supplier = await service.createSupplier(tenantId, {
      name: "Proveedor SAS",
      documentNumber: "900.123-456",
      documentTypeCode: "31",
    });

    assert.equal(supplier.documentNumberNormalized, "900123456");
    assert.equal(supplier.fiscalEmail, null);
    assert.equal(supplier.fiscalStatus, "PENDING");
  });

  it("creates a FE supplier without document number", async () => {
    const { service } = buildService({ suppliers: [] });

    const supplier = await service.createSupplier(tenantId, {
      name: "Proveedor sin documento",
    });

    assert.equal(supplier.documentNumber, null);
    assert.equal(supplier.documentNumberNormalized, null);
  });

  it("rejects invalid fiscalEmail when provided", async () => {
    const { service } = buildService({ suppliers: [] });

    await assert.rejects(
      () =>
        service.createSupplier(tenantId, {
          name: "Proveedor SAS",
          fiscalEmail: "bad-email",
        }),
      /fiscalEmail is invalid/
    );
  });

  it("rejects duplicated normalized document by tenant", async () => {
    const duplicate = buildSupplier({ id: "supplier-dup" });
    const { service } = buildService({ duplicateDocument: duplicate });

    await assert.rejects(
      () =>
        service.createSupplier(tenantId, {
          name: "Duplicado",
          documentNumber: "900123456",
        }),
      ConflictException
    );
  });

  it("updates optional fiscal fields", async () => {
    const { service } = buildService();

    const updated = await service.updateSupplier("supplier-1", tenantId, {
      legalName: "Proveedor SAS",
      fiscalEmail: "FACTURAS@PROVEEDOR.CO",
      documentNumber: "900-123-456",
      fiscalProvider: "MOCK_LOCAL",
      fiscalLastLookupStatus: "FOUND",
      fiscalStatus: "VALIDATED",
    });

    assert.equal(updated.legalName, "Proveedor SAS");
    assert.equal(updated.fiscalEmail, "facturas@proveedor.co");
    assert.equal(updated.documentNumberNormalized, "900123456");
    assert.equal(updated.fiscalProvider, "MOCK_LOCAL");
    assert.equal(updated.fiscalLastLookupStatus, "FOUND");
    assert.equal(updated.fiscalStatus, "VALIDATED");
  });

  it("rejects supplier from another tenant", async () => {
    const { service } = buildService({
      suppliers: [buildSupplier({ tenantId: otherTenantId })],
    });

    await assert.rejects(
      () =>
        service.updateSupplier("supplier-1", tenantId, {
          legalName: "Otro tenant",
        }),
      NotFoundException
    );
  });

  it("does not alter purchase linkage fields", async () => {
    const { service, state } = buildService();

    const updated = await service.updateSupplier("supplier-1", tenantId, {
      legalName: "Proveedor Compras SAS",
    });

    assert.equal(updated.id, "supplier-1");
    assert.equal(updated.tenantId, tenantId);
    assert.equal(state.purchaseRowsTouched, false);
  });
});
