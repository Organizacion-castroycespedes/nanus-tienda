export type SupplierFiscalStatus =
  | "PENDING"
  | "VALIDATED"
  | "FAILED"
  | "NOT_REQUIRED";

export type SupplierFiscalLastLookupStatus =
  | "PENDING"
  | "FOUND"
  | "NOT_FOUND"
  | "ERROR"
  | "SKIPPED";

export type SupplierFiscalDataSource =
  | "MANUAL"
  | "MOCK_LOCAL"
  | "DIAN_DIRECT"
  | "TECH_PROVIDER"
  | "RUT"
  | "UNKNOWN";

export type SupplierPersonType = "NATURAL" | "JURIDICA" | "UNKNOWN";

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
  countryId?: string | null;
  departamentoId?: string | null;
  municipioId?: string | null;
  countryCode: string | null;
  departmentCode: string | null;
  municipalityCode: string | null;
  personType: SupplierPersonType | null;
  taxRegime: string | null;
  taxResponsibilities: string[];
  fiscalStatus: SupplierFiscalStatus;
  fiscalProvider: string | null;
  fiscalDataSource: SupplierFiscalDataSource;
  isDianValidated: boolean;
  fiscalLastLookupAt: Date | null;
  fiscalLastLookupStatus: SupplierFiscalLastLookupStatus | null;
  dianMetadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ListElectronicInvoicingSuppliersFilters = {
  search?: string;
  documentTypeCode?: string;
  documentNumber?: string;
  isDianValidated?: boolean;
  fiscalDataSource?: SupplierFiscalDataSource;
  fiscalStatus?: SupplierFiscalStatus;
  isActive?: boolean;
};

export type CreateElectronicInvoicingSupplierInput = {
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
  personType?: SupplierPersonType | null;
  taxRegime?: string | null;
  taxResponsibilities?: string[];
  fiscalStatus?: SupplierFiscalStatus;
  fiscalProvider?: string | null;
  fiscalDataSource?: SupplierFiscalDataSource;
  isDianValidated?: boolean;
  fiscalLastLookupAt?: Date | null;
  fiscalLastLookupStatus?: SupplierFiscalLastLookupStatus | null;
  dianMetadata?: Record<string, unknown>;
  isActive?: boolean;
};

export type UpdateElectronicInvoicingSupplierInput = Partial<
  Pick<
    ElectronicInvoicingSupplier,
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
    | "fiscalStatus"
    | "fiscalProvider"
    | "fiscalDataSource"
    | "isDianValidated"
    | "fiscalLastLookupAt"
    | "fiscalLastLookupStatus"
    | "dianMetadata"
    | "isActive"
  >
>;
