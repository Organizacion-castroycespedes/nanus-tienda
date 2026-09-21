import type { ReportActorContext } from "./sales-report.types";
import type { PrintableCompanyHeader } from "./sales-report.types";

export type { ReportActorContext };

export type CustomerOrdersStatusRow = {
  customerId: string;
  customerName: string;
  totalOrders: number;
  pendingOrders: number;
  partialOrders: number;
  completedOrders: number;
  totalAmount: number;
  totalPending: number;
};

export type CustomerOrdersStatusDataset = {
  filters: {
    tenantId: string;
    branchId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    customerDocument: string | null;
    customerName: string | null;
    actorRole: string;
  };
  summary: {
    count: number;
    totalOrders: number;
    pendingOrders: number;
    partialOrders: number;
    completedOrders: number;
    totalAmount: number;
    totalPending: number;
  };
  rows: CustomerOrdersStatusRow[];
};

export type CustomerMasterFilters = {
  tenantId: string;
  customerDocument: string | null;
  customerName: string | null;
  actorRole: string;
};

export type CustomerMasterRow = {
  customerId: string;
  tenantId: string;
  name: string;
  documentNumber: string | null;
  documentTypeCode: string | null;
  documentNumberNormalized: string | null;
  dianIdentificationType: string | null;
  identificationNumber: string | null;
  verificationDigit: string | null;
  legalName: string | null;
  tradeName: string | null;
  phone: string | null;
  email: string | null;
  fiscalEmail: string | null;
  invoiceEmail: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  country: string | null;
  countryCode: string | null;
  departmentCode: string | null;
  municipalityCode: string | null;
  personType: "NATURAL" | "JURIDICA" | "UNKNOWN" | null;
  taxRegime: string | null;
  taxResponsibilities: string[];
  isDianValidated: boolean;
  fiscalDataSource: string;
  fiscalStatus: "PENDING" | "VALIDATED" | "FAILED" | "NOT_REQUIRED";
  dianLastLookupAt: string | null;
  dianLastLookupStatus: string | null;
  isActive: boolean;
  isFinalConsumer: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerMasterDataset = {
  filters: CustomerMasterFilters;
  summary: { count: number };
  rows: CustomerMasterRow[];
  branding: PrintableCompanyHeader;
};
