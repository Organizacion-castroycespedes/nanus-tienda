import type {
  SupplierFiscalDataSource,
  SupplierFiscalStatus,
} from "../electronic-invoicing-supplier.types";

export type ListElectronicInvoicingSuppliersDto = {
  search?: string;
  documentTypeCode?: string;
  documentNumber?: string;
  isDianValidated?: string | boolean;
  fiscalDataSource?: SupplierFiscalDataSource;
  fiscalStatus?: SupplierFiscalStatus;
  isActive?: string | boolean;
};
