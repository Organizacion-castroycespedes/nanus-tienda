import { apiClientWithBaseUrl } from "../../../lib/http";

const baseUrl = process.env.NEXT_PUBLIC_REPORTS_API_BASE_URL;
export type OperationalPeriod = "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS";
export type OperationalSnapshot = {
  meta: { timezone: string; period: OperationalPeriod; generatedAt: string };
  filters: { tenantId: string; branchId: string | null; terminalId: string | null; cashierId: string | null; dateFrom: string; dateTo: string; bucket: "hour" | "day"; actorRole: string };
  metrics: { netSales: number; transactions: number; openCashSessions: number; activeCashiers: number; pendingOrders: number; cashDifference: number };
  charts: { salesEvolution: Array<{ bucket: string; transactions: number; total: number }>; paymentMethods: Array<{ label: string; total: number }>; cashMovements: Array<{ bucket: string; cashIn: number; cashOut: number }>; ordersByState: { pending: number; partial: number; completed: number } };
  summaries: { purchases: { count: number; total: number }; customers: { active: number } };
  filterOptions: { tenants: Array<{ id: string; label: string }>; branches: Array<{ id: string; label: string }>; cashiers: Array<{ id: string; label: string }>; terminals: Array<{ id: string; label: string }> };
  details: {
    sales: Array<{ id: string; createdAt: string; branch: string | null; terminal: string | null; cashierId: string; cashier: string | null; transactions: number; amount: number }>;
    cash: Array<{ id: string; createdAt: string; branch: string | null; terminal: string | null; cashierId: string; cashier: string | null; type: string; direction: "IN" | "OUT"; amount: number; description: string | null }>;
  };
  availability: { purchases: boolean; customers: boolean };
};
export const getOperationalControl = (filters: { period: OperationalPeriod; tenantId?: string; branchId?: string; terminalId?: string; cashierId?: string }, signal?: AbortSignal) => {
  const params = new URLSearchParams({ period: filters.period });
  Object.entries(filters).forEach(([key, value]) => { if (key !== "period" && value) params.set(key, value); });
  return apiClientWithBaseUrl<OperationalSnapshot>(baseUrl, `/reports/operational-control?${params.toString()}`, { signal });
};
