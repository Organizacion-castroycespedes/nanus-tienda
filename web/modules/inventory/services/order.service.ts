import { apiClient } from "../../../lib/http";

export type OrderResponse = {
  id: string;
  tenantId: string;
  customerId: string;
  customerName?: string | null;
  type: "CASH" | "CREDIT";
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  total: number;
  createdAt: string;
};

export type CreateOrderPayload = {
  customerId: string;
  type: "CASH" | "CREDIT";
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  total: number;
};

export const getOrders = (headers?: HeadersInit) =>
  apiClient<OrderResponse[]>("/orders", { headers });

export const createOrder = (
  payload: CreateOrderPayload,
  headers?: HeadersInit
) =>
  apiClient<OrderResponse>("/orders", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const confirmOrder = (orderId: string, headers?: HeadersInit) =>
  apiClient<OrderResponse>(`/orders/${orderId}/confirm`, {
    method: "POST",
    headers,
  });

export const cancelOrder = (orderId: string, headers?: HeadersInit) =>
  apiClient<OrderResponse>(`/orders/${orderId}/cancel`, {
    method: "POST",
    headers,
  });
