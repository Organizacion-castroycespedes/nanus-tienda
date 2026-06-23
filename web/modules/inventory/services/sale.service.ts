import { apiClient } from "../../../lib/http";

export type SaleResponse = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  customerId: string;
  orderId: string | null;
  type: "CASH" | "CREDIT";
  status: "DRAFT" | "CONFIRMED" | "CANCELLED" | "REFUNDED";
  total: number;
  balance: number;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID" | "OVERPAID";
  totalPaid: number;
  balanceDue: number;
  createdAt: string;
  customerName?: string | null;
  customer?: {
    id: string;
    name: string | null;
  };
};

export type GetSalesParams = {
  branchId?: string;
  customerId?: string;
};

export const buildSalesQuery = (params: GetSalesParams = {}) => {
  const query = new URLSearchParams();
  if (params.branchId) {
    query.set("branchId", params.branchId);
  }
  if (params.customerId) {
    query.set("customerId", params.customerId);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return `/sales${suffix}`;
};

export const getSales = (
  params: GetSalesParams = {},
  headers?: HeadersInit
) => apiClient<SaleResponse[]>(buildSalesQuery(params), { headers });
