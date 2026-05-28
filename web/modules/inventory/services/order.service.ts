import { apiBlobClient, apiClient } from "../../../lib/http";

export type OrderResponse = {
  id: string;
  tenantId: string;
  tenantName?: string;
  customerId: string;
  customerName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  terminalName?: string | null;
  billingStatus?: "UNBILLED" | "PARTIAL" | "INVOICED";
  type: "CASH" | "CREDIT";
  status: "DRAFT" | "CONFIRMED" | "PARTIAL" | "COMPLETED" | "CANCELLED";
  total: number;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID" | "OVERPAID";
  totalPaid: number;
  balanceDue: number;
  createdAt: string;
};

export type OrderItemResponse = {
  id: string;
  orderId: string;
  productId: string;
  productName?: string | null;
  orderedQuantity: number;
  deliveredQuantity: number;
  billedQuantity: number;
  price: number;
  subtotal: number;
};

export type OrderDetailResponse = OrderResponse & {
  items: OrderItemResponse[];
  payments?: Array<{
    id: string;
    paymentMethodId: string;
    paymentMethodNombre?: string | null;
    paymentMethodTipo?: string | null;
    cashSessionId?: string | null;
    amount: number;
    referenceNumber?: string | null;
    notes?: string | null;
    invoicedAmount: number;
    availableAmount: number;
    createdAt: string;
  }>;
};

export type GetOrdersParams = {
  tenantId?: string;
  branchId?: string;
  fromDate?: string;
  toDate?: string;
};

export type CreateOrderPayload = {
  customerId: string;
  branchId?: string;
  type: "CASH" | "CREDIT";
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  total: number;
};

export type UpdateOrderPayload = Partial<CreateOrderPayload>;

export type DeliverOrderPayload = {
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
};

export type InvoiceOrderPayload = {
  type: "CASH" | "CREDIT";
  payments?: Array<{
    paymentMethodId: string;
    amount: number;
    cashSessionId?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
  }>;
};

export const getOrders = (
  params: GetOrdersParams = {},
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
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiClient<OrderResponse[]>(`/orders${suffix}`, { headers });
};

export const createOrder = (
  payload: CreateOrderPayload,
  headers?: HeadersInit
) =>
  apiClient<OrderResponse>("/orders", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const getOrderById = (id: string, headers?: HeadersInit) =>
  apiClient<OrderDetailResponse>(`/orders/${id}`, { headers });

export const getOrderTicket = (id: string, headers?: HeadersInit) =>
  apiBlobClient(`/orders/${id}/ticket`, { headers });

export const updateOrder = (
  id: string,
  payload: UpdateOrderPayload,
  headers?: HeadersInit
) =>
  apiClient<OrderResponse>(`/orders/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

export const deliverOrder = (
  id: string,
  payload: DeliverOrderPayload,
  headers?: HeadersInit
) =>
  apiClient<OrderResponse>(`/orders/${id}/deliver`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const confirmOrder = (orderId: string, headers?: HeadersInit) =>
  apiClient<OrderResponse>(`/orders/${orderId}/confirm`, {
    method: "POST",
    headers,
  });

export const invoiceOrder = (
  orderId: string,
  payload: InvoiceOrderPayload,
  headers?: HeadersInit
) =>
  apiClient<{ id: string }>(`/orders/${orderId}/invoice`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const cancelOrder = (orderId: string, headers?: HeadersInit) =>
  apiClient<OrderResponse>(`/orders/${orderId}/cancel`, {
    method: "POST",
    headers,
  });
