import type { FiscalStatus } from "../electronic-invoicing-customer.types";

export type UpdateElectronicInvoicingCustomerDto = {
  name?: string | null;
  documentNumber?: string | null;
  documentTypeCode?: string | null;
  verificationDigit?: string | null;
  legalName?: string | null;
  fiscalEmail?: string | null;
  isFinalConsumer?: boolean;
  fiscalStatus?: FiscalStatus;
  isActive?: boolean;
};
