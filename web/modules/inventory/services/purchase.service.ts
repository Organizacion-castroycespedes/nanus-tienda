import { apiClient } from "../../../lib/http";

export type PurchaseResponse = {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName?: string | null;
  type: "CASH" | "CREDIT";
  status: "DRAFT" | "PENDING" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  total: number;
  balance: number;
  createdAt: string;
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

export type PurchaseDetailResponse = PurchaseResponse & {
  items: PurchaseItemResponse[];
};

export type CreatePurchasePayload = {
  supplierId: string;
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

export const getPurchases = (headers?: HeadersInit) =>
  apiClient<PurchaseResponse[]>("/purchases", { headers });

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
