import type { ReportActorContext } from "./sales-report.types";

export type { ReportActorContext };

export type PurchaseReportListRow = {
  purchaseId: string;
  date: string;
  supplierName: string;
  total: number;
  paid: number;
  balance: number;
  paymentStatus: string;
  branchId: string | null;
  branchName: string | null;
  status: string;
};

export type PurchasesReportListDataset = {
  filters: {
    tenantId: string;
    branchId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    actorRole: string;
  };
  summary: {
    count: number;
    total: number;
    paid: number;
    balance: number;
  };
  rows: PurchaseReportListRow[];
};

export type PurchaseTicketDataset = {
  header: {
    purchaseId: string;
    date: string;
    tenantName: string | null;
    supplier: string;
    supplierId: string;
    branchId: string | null;
    branchName: string | null;
    userId: string | null;
    userName: string | null;
    status: string;
    paymentStatus: string;
    type: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    receivedQuantity: number;
    unitCost: number;
    subtotal: number;
  }>;
  totals: {
    total: number;
    paid: number;
    balance: number;
  };
  payments: Array<{
    paymentId: string;
    method: string;
    amount: number;
    status: string;
    referenceNumber: string | null;
    notes: string | null;
    date: string;
  }>;
};
