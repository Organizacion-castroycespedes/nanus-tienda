import { apiClient } from "../../lib/http";

export type OperationalDashboardResponse = {
  metrics: Record<string, number>;
  dailyTrend: Array<{ date: string; salesCount: number; salesAmount: number; electronicDocumentsCount: number; acceptedCount: number; rejectedCount: number; pendingOrProcessingCount: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  branches: Array<{ id: string; name: string | null }>;
};

export const fetchOperationalDashboard = (query: { period: string; dateFrom?: string; dateTo?: string; branchId?: string }) => {
  const params = new URLSearchParams({ period: query.period });
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.branchId) params.set("branchId", query.branchId);
  return apiClient<OperationalDashboardResponse>(`/operations/dashboard?${params.toString()}`);
};
