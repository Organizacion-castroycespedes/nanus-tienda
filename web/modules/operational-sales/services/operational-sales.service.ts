import { apiClient } from "../../../lib/http";
import type {
  OperationalSaleDetail,
  OperationalSalesFilters,
  OperationalSalesResponse,
} from "../types";

export type OperationalSalesRequest = {
  page: number;
  limit: number;
  sortBy: "createdAt" | "total" | "status";
  sortDirection: "ASC" | "DESC";
  filters: OperationalSalesFilters;
};

export const fetchOperationalSales = (request: OperationalSalesRequest) => {
  const params = new URLSearchParams({
    page: String(request.page),
    limit: String(request.limit),
    sortBy: request.sortBy,
    sortDirection: request.sortDirection,
  });

  Object.entries(request.filters).forEach(([key, value]) => {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  });

  return apiClient<OperationalSalesResponse>(`/operations/sales?${params.toString()}`);
};

export const fetchOperationalSaleDetail = (saleId: string) =>
  apiClient<OperationalSaleDetail>(`/operations/sales/${encodeURIComponent(saleId)}`);

export const refreshOperationalSaleBillingStatus = (saleId: string) =>
  apiClient<OperationalSaleDetail>(
    `/operations/sales/${encodeURIComponent(saleId)}/electronic-billing/refresh`,
    { method: "POST" },
  );

export const retryOperationalSaleBilling = (saleId: string) =>
  apiClient<OperationalSaleDetail>(
    `/operations/sales/${encodeURIComponent(saleId)}/electronic-billing/retry`,
    { method: "POST" },
  );
