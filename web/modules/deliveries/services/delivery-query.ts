import type { GetDeliveriesParams } from "../types";

const appendParam = (
  query: URLSearchParams,
  key: string,
  value: string | number | undefined | null
) => {
  if (value === undefined || value === null || value === "") {
    return;
  }
  query.set(key, String(value));
};

export const buildDeliveriesQuery = (params: GetDeliveriesParams = {}) => {
  const query = new URLSearchParams();
  appendParam(query, "status", params.status);
  appendParam(query, "branch_id", params.branch_id);
  appendParam(query, "customer_id", params.customer_id);
  appendParam(query, "order_id", params.order_id);
  appendParam(query, "sale_id", params.sale_id);
  appendParam(query, "driver_id", params.driver_id);
  appendParam(query, "cash_session_id", params.cash_session_id);
  appendParam(query, "cash_scope", params.cash_scope);
  appendParam(query, "date_from", params.date_from);
  appendParam(query, "date_to", params.date_to);
  appendParam(query, "page", params.page);
  appendParam(query, "limit", params.limit);

  const suffix = query.toString();
  return `/deliveries${suffix ? `?${suffix}` : ""}`;
};

export const buildOrderDeliveryEndpoint = (orderId: string) =>
  `/orders/${encodeURIComponent(orderId)}/delivery`;

export const buildSaleDeliveryEndpoint = (saleId: string) =>
  `/sales/${encodeURIComponent(saleId)}/delivery`;

export const buildDeliveryTicketPath = (deliveryId: string) =>
  `/reports/deliveries/${encodeURIComponent(deliveryId)}/ticket`;
