import type { ReportActorContext } from "./sales-report.types";

export type { ReportActorContext };

export type DeliveryTicketDataset = {
  header: {
    deliveryId: string;
    deliveryNumber: string;
    tenantName: string | null;
    branchName: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    dispatchedAt: string | null;
    deliveredAt: string | null;
    failedAt: string | null;
    cancelledAt: string | null;
  };
  customer: {
    customerId: string | null;
    name: string | null;
    phone: string | null;
    documentNumber: string | null;
  };
  address: {
    value: string;
    reference: string | null;
  };
  source: {
    orderId: string | null;
    orderStatus: string | null;
    orderDate: string | null;
    orderTotal: number | null;
    saleId: string | null;
    saleStatus: string | null;
    salePaymentStatus: string | null;
    saleDate: string | null;
    saleTotal: number | null;
  };
  driver: {
    id: string;
    name: string | null;
    phone: string | null;
    documentNumber: string | null;
    active: boolean | null;
  } | null;
  payment: {
    methodId: string | null;
    methodName: string | null;
    methodType: string | null;
  } | null;
  totals: {
    deliveryFee: number;
    sourceSubtotal: number;
    total: number;
  };
  notes: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
};
