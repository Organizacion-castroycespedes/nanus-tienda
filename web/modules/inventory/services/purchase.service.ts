import { apiBlobClient, apiClient } from "../../../lib/http";

export type PurchaseResponse = {
  id: string;
  tenantId: string;
  tenantName?: string;
  supplierId: string;
  supplierName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  terminalName?: string | null;
  type: "CASH" | "CREDIT";
  status: "DRAFT" | "PENDING" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  total: number;
  balance: number;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID" | "OVERPAID";
  totalPaid: number;
  balanceDue: number;
  createdAt: string;
  motivoCancelacion?: string | null;
  canceladoPor?: string | null;
  canceladoPorNombre?: string | null;
  canceladoEn?: string | null;
};

export type GetPurchasesParams = {
  tenantId?: string;
  branchId?: string;
  fromDate?: string;
  toDate?: string;
  paymentMethod?: string;
};

export type PurchaseItemResponse = {
  id: string;
  purchaseId: string;
  productId: string;
  productName?: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  cost: number;
  subtotal: number;
};

export type PurchaseStatusHistoryItem = {
  action: string;
  estadoAnterior?: PurchaseResponse["status"] | null;
  estadoNuevo?: PurchaseResponse["status"] | null;
  motivo?: string | null;
  usuarioId?: string | null;
  usuarioNombre?: string | null;
  createdAt: string;
};

export type PurchaseDetailResponse = PurchaseResponse & {
  items: PurchaseItemResponse[];
  statusHistory?: PurchaseStatusHistoryItem[];
};

export type CreatePurchasePayload = {
  supplierId: string;
  branchId: string;
  type: "CASH" | "CREDIT";
  items: Array<{
    productId: string;
    quantity: number;
    cost: number;
    subtotal: number;
  }>;
  total: number;
};

export type ReceivePurchasePayload = {
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
};

export type CancelPurchasePayload = {
  motivoCancelacion: string;
};

export type CancelPurchaseResponse = {
  statusCode: number;
  message: string;
  data: PurchaseResponse & {
    estado: PurchaseResponse["status"];
    motivoCancelacion: string;
    canceladoEn: string;
  };
};

export const getPurchases = (
  params: GetPurchasesParams = {},
  headers?: HeadersInit
) => {
  const query = new URLSearchParams();
  if (params.tenantId) {
    query.set("tenantId", params.tenantId);
  }
  if (params.branchId) {
    query.set("branchId", params.branchId);
  }
  if (params.fromDate) {
    query.set("fromDate", params.fromDate);
  }
  if (params.toDate) {
    query.set("toDate", params.toDate);
  }
  if (params.paymentMethod) {
    query.set("paymentMethod", params.paymentMethod);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiClient<PurchaseResponse[]>(`/purchases${suffix}`, { headers });
};

export const createPurchase = (
  payload: CreatePurchasePayload,
  headers?: HeadersInit
) =>
  apiClient<PurchaseResponse>("/purchases", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const getPurchaseById = (id: string, headers?: HeadersInit) =>
  apiClient<PurchaseDetailResponse>(`/purchases/${id}`, { headers });

export const getPurchaseTicket = (id: string, headers?: HeadersInit) =>
  apiBlobClient(`/purchases/${id}/ticket`, { headers });

export const receivePurchase = (
  id: string,
  payload: ReceivePurchasePayload,
  headers?: HeadersInit
) =>
  apiClient<PurchaseResponse>(`/purchases/${id}/receive`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const cancelPurchase = (
  id: string,
  payload: CancelPurchasePayload,
  headers?: HeadersInit
) =>
  apiClient<CancelPurchaseResponse>(`/purchases/${id}/cancel`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
