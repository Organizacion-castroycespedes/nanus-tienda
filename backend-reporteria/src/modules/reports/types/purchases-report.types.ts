import type { ReportActorContext } from "./sales-report.types";

export type { ReportActorContext };

export type PurchaseReportListRow = {
  purchaseId: string;
  date: string;
  supplierName: string;
  total: number;
  totalPedido?: number;
  totalLiquidado?: number;
  diferenciaNoRecibida?: number;
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
    status?: string | null;
    actorRole: string;
  };
  summary: {
    count: number;
    activeCount?: number;
    cancelled?: number;
    total: number;
    totalNoRecibido?: number;
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
    motivoLiquidacion?: string | null;
    liquidadoEn?: string | null;
    liquidadoPor?: string | null;
    liquidadoPorNombre?: string | null;
  };
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    receivedQuantity: number;
    unreceivedQuantity?: number;
    unitCost: number;
    subtotal: number;
    receivedSubtotal?: number;
    unreceivedSubtotal?: number;
  }>;
  totals: {
    total: number;
    totalPedido?: number;
    totalRecibido?: number;
    totalLiquidado?: number;
    diferenciaNoRecibida?: number;
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
