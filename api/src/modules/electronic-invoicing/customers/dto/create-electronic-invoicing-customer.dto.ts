import type {
  DianLastLookupStatus,
  FiscalDataSource,
  FiscalStatus,
  PersonType,
} from "../electronic-invoicing-customer.types";

export type CreateElectronicInvoicingCustomerDto = {
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
  countryId?: string | null;
  departamentoId?: string | null;
  municipioId?: string | null;
  countryCode?: string | null;
  departmentCode?: string | null;
  municipalityCode?: string | null;
  personType?: PersonType | null;
  taxRegime?: string | null;
  taxResponsibilities?: string[] | null;
  isFinalConsumer?: boolean;
  isDianValidated?: boolean;
  dianLastLookupAt?: string | Date | null;
  dianLastLookupStatus?: DianLastLookupStatus | null;
  dianMetadata?: Record<string, unknown> | null;
  fiscalDataSource?: FiscalDataSource | null;
  fiscalStatus?: FiscalStatus;
  isActive?: boolean;
};
