import { apiClient } from "../../../lib/http";

export type ElectronicInvoicingCustomer = {
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
  personType: "NATURAL" | "JURIDICA" | "UNKNOWN" | null;
  taxRegime: string | null;
  taxResponsibilities: string[];
  isFinalConsumer: boolean;
  isDianValidated: boolean;
  dianLastLookupAt: string | null;
  dianLastLookupStatus: "PENDING" | "FOUND" | "NOT_FOUND" | "ERROR" | "SKIPPED" | null;
  dianMetadata: Record<string, unknown>;
  fiscalDataSource: "MANUAL" | "MOCK_LOCAL" | "DIAN_DIRECT" | "TECH_PROVIDER" | "RUT" | "UNKNOWN";
  fiscalStatus: "PENDING" | "VALIDATED" | "FAILED" | "NOT_REQUIRED";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ThirdPartyLookupField =
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

export type ThirdPartyLookupData = {
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
  personType: "NATURAL" | "JURIDICA" | "UNKNOWN";
  taxRegime: string | null;
  taxResponsibilities: string[];
};

export type ThirdPartyLookupPreview = {
  lookupId: string;
  correlationId: string;
  provider: "MOCK_LOCAL" | "NONE";
  mode: "mock" | "disabled";
  lookupAt: string;
  requestHash: string;
  partyType: "CUSTOMER";
  lookupStatus: "FOUND" | "NOT_FOUND" | "ERROR" | "SKIPPED";
  statusCode: string;
  message: string;
  documentTypeCode: string;
  documentNumberNormalized: string;
  data: ThirdPartyLookupData | null;
  responseSummary: {
    fieldCount: number;
    fields: ThirdPartyLookupField[];
    hasLegalName: boolean;
    hasFiscalEmail: boolean;
  };
  fieldDiffs: Array<{
    field: ThirdPartyLookupField;
    currentValue: unknown;
    previewValue: unknown;
    hasChange: boolean;
    willApply: boolean;
  }>;
};

export type LookupCustomerPayload = {
  documentTypeCode?: string | null;
  dianIdentificationType?: string | null;
  documentNumber?: string | null;
  identificationNumber?: string | null;
};

export type ApplyLookupCustomerPayload = LookupCustomerPayload & {
  fieldsToApply?: ThirdPartyLookupField[];
};

export type CreateElectronicInvoicingCustomerPayload = {
  name: string;
  documentNumber?: string | null;
  documentTypeCode?: string | null;
  dianIdentificationType?: string | null;
  identificationNumber?: string | null;
  fiscalEmail?: string | null;
  invoiceEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  fiscalDataSource?: "MANUAL" | "MOCK_LOCAL";
  fiscalStatus?: "PENDING" | "VALIDATED" | "FAILED" | "NOT_REQUIRED";
  isActive?: boolean;
};

export type ApplyLookupCustomerResponse = {
  customer: ElectronicInvoicingCustomer;
  preview: ThirdPartyLookupPreview;
  appliedFields: ThirdPartyLookupField[];
};

export const lookupElectronicInvoicingCustomer = (
  payload: LookupCustomerPayload,
  headers?: HeadersInit
) =>
  apiClient<ThirdPartyLookupPreview>("/electronic-invoicing/customers/lookup", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const createElectronicInvoicingCustomer = (
  payload: CreateElectronicInvoicingCustomerPayload,
  headers?: HeadersInit
) =>
  apiClient<ElectronicInvoicingCustomer>("/electronic-invoicing/customers", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const applyElectronicInvoicingCustomerLookup = (
  customerId: string,
  payload: ApplyLookupCustomerPayload,
  headers?: HeadersInit
) =>
  apiClient<ApplyLookupCustomerResponse>(
    `/electronic-invoicing/customers/${customerId}/apply-lookup`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );
