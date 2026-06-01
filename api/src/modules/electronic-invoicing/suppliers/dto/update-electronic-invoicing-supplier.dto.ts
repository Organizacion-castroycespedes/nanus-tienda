import type {
  SupplierFiscalLastLookupStatus,
  SupplierFiscalStatus,
} from "../electronic-invoicing-supplier.types";

export type UpdateElectronicInvoicingSupplierDto = {
  name?: string | null;
  documentNumber?: string | null;
  documentTypeCode?: string | null;
  verificationDigit?: string | null;
  legalName?: string | null;
  fiscalEmail?: string | null;
  fiscalStatus?: SupplierFiscalStatus;
  fiscalProvider?: string | null;
  fiscalLastLookupStatus?: SupplierFiscalLastLookupStatus | null;
  isActive?: boolean;
};
