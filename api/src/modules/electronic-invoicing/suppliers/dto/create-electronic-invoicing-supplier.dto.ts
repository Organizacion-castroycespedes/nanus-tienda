import type {
  SupplierFiscalStatus,
} from "../electronic-invoicing-supplier.types";

export type CreateElectronicInvoicingSupplierDto = {
  name?: string | null;
  documentNumber?: string | null;
  documentTypeCode?: string | null;
  verificationDigit?: string | null;
  legalName?: string | null;
  fiscalEmail?: string | null;
  fiscalStatus?: SupplierFiscalStatus;
  fiscalProvider?: string | null;
  isActive?: boolean;
};
