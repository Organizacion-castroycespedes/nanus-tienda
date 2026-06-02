import type {
  SupplierFiscalStatus,
} from "../electronic-invoicing-supplier.types";

export type ListElectronicInvoicingSuppliersDto = {
  search?: string;
  documentTypeCode?: string;
  documentNumber?: string;
  fiscalStatus?: SupplierFiscalStatus;
  isActive?: string | boolean;
};
