import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type {
  ElectronicInvoicingSupplier,
  SupplierFiscalDataSource,
  SupplierFiscalStatus,
  SupplierPersonType,
} from "./electronic-invoicing-supplier.types";
import {
  ElectronicInvoicingSuppliersService,
  normalizeSupplierFiscalDocument,
} from "./electronic-invoicing-suppliers.service";
import { ThirdPartyLookupGetAcquirerAdapter } from "../third-party-lookup/third-party-lookup.get-acquirer-adapter";
import { ThirdPartyLookupMockAdapter } from "../third-party-lookup/third-party-lookup.mock-adapter";
import { ThirdPartyLookupService } from "../third-party-lookup/third-party-lookup.service";

const tenantId = "tenant-1";
const otherTenantId = "tenant-2";

const buildLookupService = () =>
  new ThirdPartyLookupService(
    new ThirdPartyLookupMockAdapter(),
    new ThirdPartyLookupGetAcquirerAdapter()
  );

const withMockLookupEnv = async (fn: () => Promise<void> | void) => {
  const previousEnabled = process.env.DIAN_THIRD_PARTY_LOOKUP_ENABLED;
  const previousMode = process.env.DIAN_THIRD_PARTY_LOOKUP_MODE;
  process.env.DIAN_THIRD_PARTY_LOOKUP_ENABLED = "true";
  process.env.DIAN_THIRD_PARTY_LOOKUP_MODE = "mock";
  try {
    await fn();
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.DIAN_THIRD_PARTY_LOOKUP_ENABLED;
    } else {
      process.env.DIAN_THIRD_PARTY_LOOKUP_ENABLED = previousEnabled;
    }
    if (previousMode === undefined) {
      delete process.env.DIAN_THIRD_PARTY_LOOKUP_MODE;
    } else {
      process.env.DIAN_THIRD_PARTY_LOOKUP_MODE = previousMode;
    }
  }
};

const buildSupplier = (
  overrides: Partial<ElectronicInvoicingSupplier> = {}
): ElectronicInvoicingSupplier => ({
  id: "supplier-1",
  tenantId,
  name: "Proveedor Uno",
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
  fiscalStatus: "PENDING",
  fiscalProvider: null,
  fiscalDataSource: "MANUAL",
  isDianValidated: false,
  fiscalLastLookupAt: null,
  fiscalLastLookupStatus: null,
  dianMetadata: {},
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const buildService = (
  overrides: Partial<{
    suppliers: ElectronicInvoicingSupplier[];
    duplicateDocument: ElectronicInvoicingSupplier | null;
    duplicateFiscalIdentity: ElectronicInvoicingSupplier | null;
    lookupService: ThirdPartyLookupService;
  }> = {}
) => {
  const state = {
    suppliers: overrides.suppliers ?? [buildSupplier()],
    duplicateDocument: overrides.duplicateDocument ?? null,
    duplicateFiscalIdentity: overrides.duplicateFiscalIdentity ?? null,
    purchaseRowsTouched: false,
  };

  const repository = {
    listByTenant: async () => state.suppliers,
    findById: async (id: string, requestedTenantId: string) =>
      state.suppliers.find(
        (supplier) =>
          supplier.id === id && supplier.tenantId === requestedTenantId
      ) ?? null,
    findByFiscalIdentity: async () => state.duplicateFiscalIdentity,
    findByNormalizedDocument: async () => state.duplicateDocument,
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
      personType?: SupplierPersonType | null;
      taxRegime?: string | null;
      taxResponsibilities?: string[];
      fiscalStatus?: SupplierFiscalStatus;
      fiscalProvider?: string | null;
      fiscalDataSource?: SupplierFiscalDataSource;
      isDianValidated?: boolean;
      dianMetadata?: Record<string, unknown>;
      isActive?: boolean;
    }) => {
      const supplier = buildSupplier({
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
        fiscalStatus: input.fiscalStatus ?? "PENDING",
        fiscalProvider: input.fiscalProvider ?? null,
        fiscalDataSource: input.fiscalDataSource ?? "MANUAL",
        isDianValidated: input.isDianValidated ?? false,
        dianMetadata: input.dianMetadata ?? {},
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
    service: new ElectronicInvoicingSuppliersService(
      repository as never,
      overrides.lookupService
    ),
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
    assert.equal(supplier.dianIdentificationType, "31");
    assert.equal(supplier.identificationNumber, "900123456");
    assert.equal(supplier.tradeName, "Proveedor SAS");
    assert.equal(supplier.fiscalEmail, null);
    assert.equal(supplier.invoiceEmail, null);
    assert.equal(supplier.fiscalDataSource, "MANUAL");
    assert.equal(supplier.fiscalStatus, "PENDING");
  });

  it("creates a FE supplier with minimum fiscal base fields", async () => {
    const { service } = buildService({ suppliers: [] });

    const supplier = await service.createSupplier(tenantId, {
      name: "Proveedor SAS",
      documentNumber: "900.123-456",
      dianIdentificationType: "31",
      invoiceEmail: "FACTURAS@PROVEEDOR.CO",
      phone: "3007654321",
      address: "CL 4 5 6",
      countryCode: "CO",
      departmentCode: "11",
      municipalityCode: "11001",
      personType: "JURIDICA",
      taxRegime: "ORDINARIO",
      taxResponsibilities: ["R-99-PN"],
      fiscalDataSource: "MOCK_LOCAL",
      dianMetadata: { source: "manual" },
    });

    assert.equal(supplier.documentTypeCode, "31");
    assert.equal(supplier.dianIdentificationType, "31");
    assert.equal(supplier.invoiceEmail, "facturas@proveedor.co");
    assert.equal(supplier.fiscalEmail, "facturas@proveedor.co");
    assert.equal(supplier.phone, "3007654321");
    assert.equal(supplier.address, "CL 4 5 6");
    assert.equal(supplier.countryCode, "CO");
    assert.equal(supplier.departmentCode, "11");
    assert.equal(supplier.municipalityCode, "11001");
    assert.equal(supplier.personType, "JURIDICA");
    assert.deepEqual(supplier.taxResponsibilities, ["R-99-PN"]);
    assert.equal(supplier.fiscalDataSource, "MOCK_LOCAL");
    assert.deepEqual(supplier.dianMetadata, { source: "manual" });
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

  it("rejects duplicated fiscal identity by tenant", async () => {
    const duplicate = buildSupplier({ id: "supplier-dup" });
    const { service } = buildService({ duplicateFiscalIdentity: duplicate });

    await assert.rejects(
      () =>
        service.createSupplier(tenantId, {
          name: "Duplicado",
          documentNumber: "900123456",
          documentTypeCode: "31",
        }),
      ConflictException
    );
  });

  it("allows same number with different document type", async () => {
    const duplicateByNumber = buildSupplier({ id: "supplier-dup" });
    const { service } = buildService({ duplicateDocument: duplicateByNumber });

    const supplier = await service.createSupplier(tenantId, {
      name: "Mismo numero otro tipo",
      documentNumber: "900123456",
      documentTypeCode: "13",
    });

    assert.equal(supplier.documentTypeCode, "13");
    assert.equal(supplier.identificationNumber, "900123456");
  });

  it("rejects DIAN_DIRECT for suppliers", async () => {
    const { service } = buildService({ suppliers: [] });

    await assert.rejects(
      () =>
        service.createSupplier(tenantId, {
          name: "Proveedor DIAN",
          fiscalDataSource: "DIAN_DIRECT",
        }),
      /DIAN_DIRECT is not supported for suppliers/
    );
  });

  it("updates optional fiscal fields", async () => {
    const { service } = buildService();

    const updated = await service.updateSupplier("supplier-1", tenantId, {
      legalName: "Proveedor SAS",
      fiscalEmail: "FACTURAS@PROVEEDOR.CO",
      documentNumber: "900-123-456",
      fiscalProvider: "MOCK_LOCAL",
      fiscalDataSource: "MOCK_LOCAL",
      fiscalLastLookupStatus: "FOUND",
      fiscalStatus: "VALIDATED",
      countryCode: "CO",
      personType: "JURIDICA",
      taxResponsibilities: ["O-13"],
    });

    assert.equal(updated.legalName, "Proveedor SAS");
    assert.equal(updated.fiscalEmail, "facturas@proveedor.co");
    assert.equal(updated.invoiceEmail, "facturas@proveedor.co");
    assert.equal(updated.documentNumberNormalized, "900123456");
    assert.equal(updated.identificationNumber, "900123456");
    assert.equal(updated.fiscalProvider, "MOCK_LOCAL");
    assert.equal(updated.fiscalDataSource, "MOCK_LOCAL");
    assert.equal(updated.fiscalLastLookupStatus, "FOUND");
    assert.equal(updated.fiscalStatus, "VALIDATED");
    assert.equal(updated.countryCode, "CO");
    assert.equal(updated.personType, "JURIDICA");
    assert.deepEqual(updated.taxResponsibilities, ["O-13"]);
  });

  it("previews supplier mock lookup with provider-agnostic adapter", async () => {
    await withMockLookupEnv(() => {
      const { service } = buildService({ lookupService: buildLookupService() });

      const preview = service.lookupSupplierFiscalData(tenantId, {
        documentTypeCode: "31",
        documentNumber: "900.123-456",
      });

      assert.equal(preview.lookupStatus, "FOUND");
      assert.equal(preview.provider, "MOCK_LOCAL");
      assert.notEqual(preview.provider, "DIAN_DIRECT");
      assert.equal(preview.data?.legalName, "Proveedor Mock SAS 3456");
    });
  });

  it("applies only selected supplier lookup fields and status summary", async () => {
    await withMockLookupEnv(async () => {
      const { service } = buildService({ lookupService: buildLookupService() });

      const result = await service.applySupplierLookup("supplier-1", tenantId, {
        documentTypeCode: "31",
        documentNumber: "900.123-456",
        fieldsToApply: ["legalName", "fiscalEmail"],
      });

      assert.equal(result.supplier.legalName, "Proveedor Mock SAS 3456");
      assert.equal(result.supplier.fiscalEmail, "proveedor-3456@mock.local");
      assert.equal(result.supplier.address, null);
      assert.equal(result.supplier.fiscalProvider, "MOCK_LOCAL");
      assert.equal(result.supplier.fiscalDataSource, "MOCK_LOCAL");
      assert.equal(result.supplier.fiscalLastLookupStatus, "FOUND");
      assert.equal(result.supplier.fiscalStatus, "VALIDATED");
      assert.equal(result.supplier.isDianValidated, true);
      assert.deepEqual(result.appliedFields, ["legalName", "fiscalEmail"]);

      const metadata = result.supplier.dianMetadata.thirdPartyLookup as {
        lastLookup?: Record<string, unknown>;
      };
      assert.equal(metadata.lastLookup?.provider, "MOCK_LOCAL");
      assert.equal(
        Object.prototype.hasOwnProperty.call(metadata.lastLookup ?? {}, "data"),
        false
      );
    });
  });

  it("does not overwrite supplier data without selected fields", async () => {
    await withMockLookupEnv(async () => {
      const supplier = buildSupplier({ legalName: "Proveedor Manual SAS" });
      const { service } = buildService({
        suppliers: [supplier],
        lookupService: buildLookupService(),
      });

      const result = await service.applySupplierLookup("supplier-1", tenantId, {
        documentTypeCode: "31",
        documentNumber: "900.123-456",
      });

      assert.equal(result.supplier.legalName, "Proveedor Manual SAS");
      assert.equal(result.supplier.fiscalProvider, "MOCK_LOCAL");
      assert.equal(result.supplier.fiscalLastLookupStatus, "FOUND");
      assert.equal(result.supplier.fiscalStatus, "PENDING");
      assert.deepEqual(result.appliedFields, []);
    });
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
