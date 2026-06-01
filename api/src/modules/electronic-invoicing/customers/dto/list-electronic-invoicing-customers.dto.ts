import type { FiscalStatus } from "../electronic-invoicing-customer.types";

export type ListElectronicInvoicingCustomersDto = {
  search?: string;
  documentTypeCode?: string;
  documentNumber?: string;
  isFinalConsumer?: string | boolean;
  fiscalStatus?: FiscalStatus;
  isActive?: string | boolean;
};
