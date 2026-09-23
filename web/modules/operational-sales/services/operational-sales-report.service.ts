import { apiBlobClientWithBaseUrl } from "../../../lib/http";
import type { OperationalSalesFilters } from "../types";

const reportsBaseUrl = process.env.NEXT_PUBLIC_REPORTS_API_BASE_URL;
type ReportQuery = Pick<OperationalSalesFilters, "dateFrom" | "dateTo" | "status" | "paymentStatus" | "paymentMethod" | "customerId" | "documentNumber" | "electronicBillingStatus">;

const buildQuery = (filters: ReportQuery, sortBy: "createdAt" | "total" | "status", sortDirection: "ASC" | "DESC", format: "pdf" | "xlsx") => {
  const params = new URLSearchParams({ format, sortBy, sortDirection });
  Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
  return `?${params.toString()}`;
};

export const getOperationalSalesReportPdf = (filters: ReportQuery, sortBy: "createdAt" | "total" | "status", sortDirection: "ASC" | "DESC") => apiBlobClientWithBaseUrl(reportsBaseUrl, `/reports/operational-sales${buildQuery(filters, sortBy, sortDirection, "pdf")}`, { includePosSession: true });
export const getOperationalSalesReportExcel = (filters: ReportQuery, sortBy: "createdAt" | "total" | "status", sortDirection: "ASC" | "DESC") => apiBlobClientWithBaseUrl(reportsBaseUrl, `/reports/operational-sales${buildQuery(filters, sortBy, sortDirection, "xlsx")}`, { includePosSession: true });
