import type { ReportActorContext } from "./sales-report.types";

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
