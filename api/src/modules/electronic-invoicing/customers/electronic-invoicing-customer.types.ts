export type FiscalStatus = "PENDING" | "VALIDATED" | "FAILED" | "NOT_REQUIRED";

export type DianLastLookupStatus =
  | "PENDING"
  | "FOUND"
  | "NOT_FOUND"
  | "ERROR"
  | "SKIPPED";

export type FiscalDataSource =
  | "MANUAL"
  | "MOCK_LOCAL"
  | "DIAN_DIRECT"
  | "TECH_PROVIDER"
  | "RUT"
  | "UNKNOWN";

export type PersonType = "NATURAL" | "JURIDICA" | "UNKNOWN";

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
  countryId?: string | null;
  departamentoId?: string | null;
  municipioId?: string | null;
  countryCode: string | null;
  departmentCode: string | null;
  municipalityCode: string | null;
  personType: PersonType | null;
  taxRegime: string | null;
  taxResponsibilities: string[];
  isFinalConsumer: boolean;
  isDianValidated: boolean;
  dianLastLookupAt: Date | null;
  dianLastLookupStatus: DianLastLookupStatus | null;
  dianMetadata: Record<string, unknown>;
  fiscalDataSource: FiscalDataSource;
  fiscalStatus: FiscalStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ListElectronicInvoicingCustomersFilters = {
  search?: string;
  documentTypeCode?: string;
  documentNumber?: string;
  isFinalConsumer?: boolean;
  isDianValidated?: boolean;
  fiscalDataSource?: FiscalDataSource;
  fiscalStatus?: FiscalStatus;
  isActive?: boolean;
};

export type CreateElectronicInvoicingCustomerInput = {
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
  countryId?: string | null;
  departamentoId?: string | null;
  municipioId?: string | null;
  countryCode?: string | null;
  departmentCode?: string | null;
  municipalityCode?: string | null;
  personType?: PersonType | null;
  taxRegime?: string | null;
  taxResponsibilities?: string[];
  isFinalConsumer?: boolean;
  isDianValidated?: boolean;
  dianLastLookupAt?: Date | null;
  dianLastLookupStatus?: DianLastLookupStatus | null;
  dianMetadata?: Record<string, unknown>;
  fiscalDataSource?: FiscalDataSource;
  fiscalStatus?: FiscalStatus;
  isActive?: boolean;
};

export type UpdateElectronicInvoicingCustomerInput = Partial<
  Pick<
    ElectronicInvoicingCustomer,
    | "name"
    | "documentNumber"
    | "documentTypeCode"
    | "documentNumberNormalized"
    | "dianIdentificationType"
    | "identificationNumber"
    | "verificationDigit"
    | "legalName"
    | "tradeName"
    | "fiscalEmail"
    | "invoiceEmail"
    | "phone"
    | "address"
    | "countryId"
    | "departamentoId"
    | "municipioId"
    | "countryCode"
    | "departmentCode"
    | "municipalityCode"
    | "personType"
    | "taxRegime"
    | "taxResponsibilities"
    | "isFinalConsumer"
    | "isDianValidated"
    | "dianLastLookupAt"
    | "dianLastLookupStatus"
    | "dianMetadata"
    | "fiscalDataSource"
    | "fiscalStatus"
    | "isActive"
  >
>;
