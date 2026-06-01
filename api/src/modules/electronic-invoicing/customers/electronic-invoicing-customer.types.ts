export type FiscalStatus = "PENDING" | "VALIDATED" | "FAILED" | "NOT_REQUIRED";

export type DianLastLookupStatus =
  | "PENDING"
  | "FOUND"
  | "NOT_FOUND"
  | "ERROR"
  | "SKIPPED";

export type ElectronicInvoicingCustomer = {
  id: string;
  tenantId: string;
  name: string;
  documentNumber: string | null;
  documentTypeCode: string | null;
  documentNumberNormalized: string | null;
  verificationDigit: string | null;
  legalName: string | null;
  fiscalEmail: string | null;
  isFinalConsumer: boolean;
  dianLastLookupAt: Date | null;
  dianLastLookupStatus: DianLastLookupStatus | null;
  fiscalStatus: FiscalStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ListElectronicInvoicingCustomersFilters = {
  search?: string;
  documentTypeCode?: string;
  documentNumber?: string;
  isFinalConsumer?: boolean;
  fiscalStatus?: FiscalStatus;
  isActive?: boolean;
};

export type CreateElectronicInvoicingCustomerInput = {
  id: string;
  tenantId: string;
  name: string;
  documentNumber?: string | null;
  documentTypeCode?: string | null;
  documentNumberNormalized?: string | null;
  verificationDigit?: string | null;
  legalName?: string | null;
  fiscalEmail?: string | null;
  isFinalConsumer?: boolean;
  fiscalStatus?: FiscalStatus;
  isActive?: boolean;
};

export type UpdateElectronicInvoicingCustomerInput = Partial<
  Pick<
    ElectronicInvoicingCustomer,
    | "name"
    | "documentNumber"
    | "documentTypeCode"
    | "documentNumberNormalized"
    | "verificationDigit"
    | "legalName"
    | "fiscalEmail"
    | "isFinalConsumer"
    | "fiscalStatus"
    | "isActive"
  >
>;
