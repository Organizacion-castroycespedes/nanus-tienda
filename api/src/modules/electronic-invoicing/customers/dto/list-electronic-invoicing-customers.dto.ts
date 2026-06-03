import type {
  FiscalDataSource,
  FiscalStatus,
} from "../electronic-invoicing-customer.types";

export type ListElectronicInvoicingCustomersDto = {
  search?: string;
  documentTypeCode?: string;
  documentNumber?: string;
  isFinalConsumer?: string | boolean;
  isDianValidated?: string | boolean;
  fiscalDataSource?: FiscalDataSource;
  fiscalStatus?: FiscalStatus;
  isActive?: string | boolean;
};
