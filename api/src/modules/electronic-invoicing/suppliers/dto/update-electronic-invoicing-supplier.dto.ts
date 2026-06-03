import type {
  SupplierFiscalDataSource,
  SupplierFiscalLastLookupStatus,
  SupplierFiscalStatus,
  SupplierPersonType,
} from "../electronic-invoicing-supplier.types";

export type UpdateElectronicInvoicingSupplierDto = {
  name?: string | null;
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
  personType?: SupplierPersonType | null;
  taxRegime?: string | null;
  taxResponsibilities?: string[] | null;
  fiscalStatus?: SupplierFiscalStatus;
  fiscalProvider?: string | null;
  fiscalDataSource?: SupplierFiscalDataSource | null;
  isDianValidated?: boolean;
  fiscalLastLookupAt?: string | Date | null;
  fiscalLastLookupStatus?: SupplierFiscalLastLookupStatus | null;
  dianMetadata?: Record<string, unknown> | null;
  isActive?: boolean;
};
