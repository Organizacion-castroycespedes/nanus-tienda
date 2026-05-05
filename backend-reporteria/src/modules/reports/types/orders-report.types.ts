import type { ReportActorContext } from "./sales-report.types";

export type { ReportActorContext };

export type OrderSalesListRow = {
  orderId: string;
  date: string;
  customerName: string;
  total: number;
  paid: number;
  balance: number;
  status: string;
  paymentStatus: string;
  branchId: string | null;
  branchName: string | null;
  generatedSaleId: string | null;
};

export type OrderSalesListDataset = {
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
    completed: number;
    partial: number;
    pending: number;
  };
  rows: OrderSalesListRow[];
};

export type OrderSaleTicketDataset = {
  header: {
    orderId: string;
    date: string;
    tenantName: string | null;
    customerId: string;
    customerName: string;
    branchId: string | null;
    branchName: string | null;
    status: string;
    paymentStatus: string;
    type: string;
  };
  generatedSales: Array<{
    saleId: string;
    date: string;
    status: string;
    paymentStatus: string;
    total: number;
    paid: number;
    balance: number;
    branchId: string | null;
    branchName: string | null;
    cashierId: string | null;
    cashierName: string | null;
  }>;
  items: Array<{
    orderItemId: string;
    productId: string;
    productName: string;
    orderedQuantity: number;
    deliveredQuantity: number;
    billedQuantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  payments: Array<{
    paymentId: string;
    source: string;
    method: string;
    amount: number;
    status: string;
    referenceNumber: string | null;
    notes: string | null;
    date: string;
  }>;
  totals: {
    total: number;
    paid: number;
    balance: number;
  };
};
