import { apiClient } from "../../../lib/http";

export type ElectronicInvoicingSupplierFiscalStatus =
  | "PENDING"
  | "VALIDATED"
  | "FAILED"
  | "NOT_REQUIRED";

export type ElectronicInvoicingSupplierFiscalDataSource =
  | "MANUAL"
  | "MOCK_LOCAL"
  | "TECH_PROVIDER"
  | "RUT"
  | "UNKNOWN";

export type ElectronicInvoicingSupplierPersonType =
  | "NATURAL"
  | "JURIDICA"
  | "UNKNOWN";

export type ElectronicInvoicingSupplier = {
  id: string;
  tenantId: string;
  name: string;
  documentNumber: string | null;
  documentTypeCode: string | null;
  documentNumberNormalized: string | null;
  dianIdentificationType: string | null;
  identificationNumber: string | null;
  verificationDigit: string | null;
  legalName: string | null;
  tradeName: string | null;
  fiscalEmail: string | null;
  invoiceEmail: string | null;
  phone: string | null;
  address: string | null;
  countryCode: string | null;
  departmentCode: string | null;
  municipalityCode: string | null;
  personType: ElectronicInvoicingSupplierPersonType | null;
  taxRegime: string | null;
  taxResponsibilities: string[];
  fiscalStatus: ElectronicInvoicingSupplierFiscalStatus;
  fiscalProvider: string | null;
  fiscalDataSource: ElectronicInvoicingSupplierFiscalDataSource;
  isDianValidated: boolean;
  fiscalLastLookupAt: string | null;
  fiscalLastLookupStatus:
    | "PENDING"
    | "FOUND"
    | "NOT_FOUND"
    | "ERROR"
    | "SKIPPED"
    | null;
  dianMetadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ThirdPartySupplierLookupField =
  | "name"
  | "documentTypeCode"
  | "documentNumber"
  | "verificationDigit"
  | "legalName"
  | "tradeName"
  | "fiscalEmail"
  | "phone"
  | "address"
  | "countryCode"
  | "departmentCode"
  | "municipalityCode"
  | "personType"
  | "taxRegime"
  | "taxResponsibilities";

export type ThirdPartySupplierLookupData = {
  name: string;
  documentNumber: string;
  documentTypeCode: string;
  documentNumberNormalized: string;
  dianIdentificationType: string;
  identificationNumber: string;
  verificationDigit: string | null;
  legalName: string;
  tradeName: string;
  fiscalEmail: string | null;
  invoiceEmail: string | null;
  phone: string | null;
  address: string | null;
  countryCode: string | null;
  departmentCode: string | null;
  municipalityCode: string | null;
  personType: ElectronicInvoicingSupplierPersonType;
  taxRegime: string | null;
  taxResponsibilities: string[];
};

export type ThirdPartySupplierLookupPreview = {
  lookupId: string;
  correlationId: string;
  provider: "MOCK_LOCAL" | "NONE" | "DIAN_GET_ACQUIRER";
  mode: "mock" | "disabled" | "real";
  lookupAt: string;
  requestHash: string;
  partyType: "SUPPLIER";
  lookupStatus: "FOUND" | "NOT_FOUND" | "ERROR" | "SKIPPED";
  statusCode: string;
  message: string;
  documentTypeCode: string;
  documentNumberNormalized: string;
  data: ThirdPartySupplierLookupData | null;
  responseSummary: {
    fieldCount: number;
    fields: ThirdPartySupplierLookupField[];
    hasLegalName: boolean;
    hasFiscalEmail: boolean;
  };
  fieldDiffs: Array<{
    field: ThirdPartySupplierLookupField;
    currentValue: unknown;
    previewValue: unknown;
    hasChange: boolean;
    willApply: boolean;
  }>;
};

export type LookupSupplierPayload = {
  documentTypeCode?: string | null;
  dianIdentificationType?: string | null;
  documentNumber?: string | null;
  identificationNumber?: string | null;
};

export type ApplyLookupSupplierPayload = LookupSupplierPayload & {
  fieldsToApply?: ThirdPartySupplierLookupField[];
};

export type CreateElectronicInvoicingSupplierPayload = {
  name: string;
  documentNumber?: string | null;
  documentTypeCode?: string | null;
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
  personType?: ElectronicInvoicingSupplierPersonType | null;
  taxRegime?: string | null;
  taxResponsibilities?: string[] | null;
  fiscalStatus?: ElectronicInvoicingSupplierFiscalStatus;
  fiscalProvider?: string | null;
  fiscalDataSource?: ElectronicInvoicingSupplierFiscalDataSource | null;
  isDianValidated?: boolean;
  fiscalLastLookupAt?: string | null;
  fiscalLastLookupStatus?:
    | "PENDING"
    | "FOUND"
    | "NOT_FOUND"
    | "ERROR"
    | "SKIPPED"
    | null;
  dianMetadata?: Record<string, unknown> | null;
  isActive?: boolean;
};

export type UpdateElectronicInvoicingSupplierPayload =
  Partial<CreateElectronicInvoicingSupplierPayload>;

export type ListElectronicInvoicingSuppliersFilters = {
  search?: string;
  documentTypeCode?: string;
  documentNumber?: string;
  isDianValidated?: boolean;
  fiscalDataSource?: ElectronicInvoicingSupplier["fiscalDataSource"];
  fiscalStatus?: ElectronicInvoicingSupplier["fiscalStatus"];
  isActive?: boolean;
};

export type ApplyLookupSupplierResponse = {
  supplier: ElectronicInvoicingSupplier;
  preview: ThirdPartySupplierLookupPreview;
  appliedFields: ThirdPartySupplierLookupField[];
};

const buildSupplierQuery = (
  filters: ListElectronicInvoicingSuppliersFilters = {}
) => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    params.set(key, String(value));
  });

  const query = params.toString();
  return query ? `?${query}` : "";
};

export const listElectronicInvoicingSuppliers = (
  filters?: ListElectronicInvoicingSuppliersFilters,
  headers?: HeadersInit
) =>
  apiClient<ElectronicInvoicingSupplier[]>(
    `/electronic-invoicing/suppliers${buildSupplierQuery(filters)}`,
    { headers }
  );

export const getElectronicInvoicingSupplier = (
  supplierId: string,
  headers?: HeadersInit
) =>
  apiClient<ElectronicInvoicingSupplier>(
    `/electronic-invoicing/suppliers/${supplierId}`,
    { headers }
  );

export const lookupElectronicInvoicingSupplier = (
  payload: LookupSupplierPayload,
  headers?: HeadersInit
) =>
  apiClient<ThirdPartySupplierLookupPreview>(
    "/electronic-invoicing/suppliers/lookup",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );

export const createElectronicInvoicingSupplier = (
  payload: CreateElectronicInvoicingSupplierPayload,
  headers?: HeadersInit
) =>
  apiClient<ElectronicInvoicingSupplier>("/electronic-invoicing/suppliers", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateElectronicInvoicingSupplier = (
  supplierId: string,
  payload: UpdateElectronicInvoicingSupplierPayload,
  headers?: HeadersInit
) =>
  apiClient<ElectronicInvoicingSupplier>(
    `/electronic-invoicing/suppliers/${supplierId}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    }
  );

export const applyElectronicInvoicingSupplierLookup = (
  supplierId: string,
  payload: ApplyLookupSupplierPayload,
  headers?: HeadersInit
) =>
  apiClient<ApplyLookupSupplierResponse>(
    `/electronic-invoicing/suppliers/${supplierId}/apply-lookup`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );
