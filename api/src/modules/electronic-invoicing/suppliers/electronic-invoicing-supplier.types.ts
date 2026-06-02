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

export type ElectronicInvoicingSupplier = {
  id: string;
  tenantId: string;
  name: string;
  documentNumber: string | null;
  documentTypeCode: string | null;
  documentNumberNormalized: string | null;
  verificationDigit: string | null;
  legalName: string | null;
  fiscalEmail: string | null;
  fiscalStatus: SupplierFiscalStatus;
  fiscalProvider: string | null;
  fiscalLastLookupAt: Date | null;
  fiscalLastLookupStatus: SupplierFiscalLastLookupStatus | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ListElectronicInvoicingSuppliersFilters = {
  search?: string;
  documentTypeCode?: string;
  documentNumber?: string;
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
  verificationDigit?: string | null;
  legalName?: string | null;
  fiscalEmail?: string | null;
  fiscalStatus?: SupplierFiscalStatus;
  fiscalProvider?: string | null;
  isActive?: boolean;
};

export type UpdateElectronicInvoicingSupplierInput = Partial<
  Pick<
    ElectronicInvoicingSupplier,
    | "name"
    | "documentNumber"
    | "documentTypeCode"
    | "documentNumberNormalized"
    | "verificationDigit"
    | "legalName"
    | "fiscalEmail"
    | "fiscalStatus"
    | "fiscalProvider"
    | "fiscalLastLookupStatus"
    | "isActive"
  >
>;
