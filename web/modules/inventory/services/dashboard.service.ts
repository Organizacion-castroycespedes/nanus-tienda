import { apiClient } from "../../../lib/http";

export type InventoryDashboardFilterOption = {
  id: string;
  name: string;
  extra?: string | null;
};

export type InventoryDashboardCashSessionOption = {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  cashRegisterId: string;
  cashRegisterName: string;
  terminalId: string | null;
  terminalName: string | null;
  openedAt: string;
  status: string;
  openedByUserId: string;
};

export type InventoryDashboardResponse = {
  summary: {
    stockTotal: number;
    productsLow: number;
    productsOut: number;
    pendingPurchases: number;
    pendingOrders: number;
    salesDay: number;
    recentMovements: number;
  };
  header: {
    tenant?: { id: string; name: string | null } | null;
    branch?: { id: string; name: string | null } | null;
    terminal?: { id: string; name: string | null; code?: string | null } | null;
    cashSession?: {
      id: string;
      status: string;
      openedAt: string;
      cashRegisterId: string;
      cashRegisterName: string | null;
      branchId: string | null;
    } | null;
  };
  charts: {
    movementSeries: Array<{ date: string; entries: number; exits: number }>;
    salesSeries: Array<{ date: string; total: number }>;
    purchaseSeries: Array<{ date: string; total: number }>;
    topProducts: Array<{
      id: string;
      name: string;
      sku: string;
      quantity: number;
      total: number;
    }>;
  };
  tables: {
    recentMovements: Array<{
      id: string;
      type: string;
      quantity: number;
      referenceType: string;
      referenceId: string;
      productName: string;
      sku: string;
      branchName: string | null;
      terminalName: string | null;
      stockBefore: number | null;
      stockAfter: number | null;
      createdAt: string;
    }>;
    recentPurchases: Array<{
      id: string;
      status: string;
      type: string;
      total: number;
      balanceDue: number;
      supplierName: string | null;
      branchName: string | null;
      terminalName: string | null;
      createdAt: string;
    }>;
    criticalProducts: Array<{
      productId: string;
      productName: string;
      sku: string;
      branchId: string;
      branchName: string;
      stock: number;
      outboundInPeriod: number;
      lastMovementAt: string | null;
    }>;
    pendingOrders: Array<{
      id: string;
      status: string;
      type: string;
      total: number;
      balanceDue: number;
      pendingQuantity: number;
      customerName: string | null;
      branchName: string | null;
      terminalName: string | null;
      createdAt: string;
    }>;
  };
  scope: {
    tenantId: string;
    branchId: string | null;
    terminalId: string | null;
    cashSessionId: string | null;
    startDate: string;
    endDate: string;
  };
  filters: {
    tenants: InventoryDashboardFilterOption[];
    branches: InventoryDashboardFilterOption[];
    terminals: InventoryDashboardFilterOption[];
    cashSessions: InventoryDashboardCashSessionOption[];
  };
};

export type GetInventoryDashboardParams = {
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  cashSessionId?: string;
  startDate?: string;
  endDate?: string;
};

export const getInventoryDashboard = (
  params: GetInventoryDashboardParams = {},
  headers?: HeadersInit
) => {
  const query = new URLSearchParams();

  if (params.tenantId) {
    query.set("tenantId", params.tenantId);
  }
  if (params.branchId) {
    query.set("branchId", params.branchId);
  }
  if (params.terminalId) {
    query.set("terminalId", params.terminalId);
  }
  if (params.cashSessionId) {
    query.set("cashSessionId", params.cashSessionId);
  }
  if (params.startDate) {
    query.set("startDate", params.startDate);
  }
  if (params.endDate) {
    query.set("endDate", params.endDate);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiClient<InventoryDashboardResponse>(`/inventory/dashboard${suffix}`, {
    headers,
  });
};
