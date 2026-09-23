import type { PrintableCompanyHeader } from "./sales-report.types";

export type OperationalSalesReportQuery = {
  branchId?: string;
  userId?: string;
  cashSessionId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  customerId?: string;
  documentNumber?: string;
  electronicBillingStatus?: string;
  sortBy?: "createdAt" | "total" | "status";
  sortDirection?: "ASC" | "DESC";
};

export type OperationalSalesScope = {
  tenantId: string;
  branchIds: string[];
  userId?: string;
  cashSessionId?: string;
  requiresCurrentShift: boolean;
};

export type OperationalSalesReportRow = {
  id: string;
  createdAt: string;
  status: string;
  saleType: string;
  paymentStatus: string;
  total: number;
  customerName: string | null;
  branchName: string | null;
  operatorEmail: string | null;
  cashSessionId: string | null;
  electronicBillingStatus: string;
  electronicDocumentNumber: string | null;
  electronicCufe: string | null;
  providerStatus: string | null;
};

export type OperationalSalesReportDataset = {
  rows: OperationalSalesReportRow[];
  query: OperationalSalesReportQuery;
  branding: PrintableCompanyHeader;
};
