import { apiBlobClientWithBaseUrl, apiClient } from "../../../lib/http";
import type {
  AssignDeliveryDriverPayload,
  AssignDeliveryPayload,
  CancelDeliveryPayload,
  CreateDeliveryPayload,
  DeliveryListResponse,
  DeliveryRecord,
  DispatchDeliveryPayload,
  GetDeliveriesParams,
  MarkDeliveryDeliveredPayload,
  MarkDeliveryNotDeliveredPayload,
} from "../types";
import {
  buildDeliveryTicketPath,
  buildDeliveriesQuery,
  buildOrderDeliveryEndpoint,
  buildSaleDeliveryEndpoint,
} from "./delivery-query";

const reportsBaseUrl = process.env.NEXT_PUBLIC_REPORTS_API_BASE_URL;

export {
  buildDeliveryTicketPath,
  buildDeliveriesQuery,
  buildOrderDeliveryEndpoint,
  buildSaleDeliveryEndpoint,
};

export const listDeliveries = (params: GetDeliveriesParams = {}) =>
  apiClient<DeliveryListResponse>(buildDeliveriesQuery(params), {
    includePosSession: true,
  });

export const getDeliveryById = (deliveryId: string) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}`);

export const getDeliveryTicket = (deliveryId: string) =>
  apiBlobClientWithBaseUrl(reportsBaseUrl, buildDeliveryTicketPath(deliveryId));

export const createDelivery = (payload: CreateDeliveryPayload) =>
  apiClient<DeliveryRecord>("/deliveries", {
    method: "POST",
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const updateDelivery = (
  deliveryId: string,
  payload: Partial<CreateDeliveryPayload>
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}`, {
    method: "PATCH",
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const assignDelivery = (
  deliveryId: string,
  payload: AssignDeliveryPayload
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/assign`, {
    method: "POST",
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const assignDeliveryDriver = (
  deliveryId: string,
  payload: AssignDeliveryDriverPayload
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/assign-driver`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const prepareDelivery = (
  deliveryId: string,
  payload: AssignDeliveryPayload = {}
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/prepare`, {
    method: "POST",
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const dispatchDelivery = (
  deliveryId: string,
  payload: DispatchDeliveryPayload = {}
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/dispatch`, {
    method: "POST",
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const markDeliveryDelivered = (
  deliveryId: string,
  payload: MarkDeliveryDeliveredPayload = {}
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/mark-delivered`, {
    method: "POST",
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const markDeliveryNotDelivered = (
  deliveryId: string,
  payload: MarkDeliveryNotDeliveredPayload
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/mark-not-delivered`, {
    method: "POST",
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const cancelDelivery = (
  deliveryId: string,
  payload: CancelDeliveryPayload
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/cancel`, {
    method: "POST",
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const getOrderDelivery = (orderId: string) =>
  apiClient<DeliveryRecord | null>(buildOrderDeliveryEndpoint(orderId), {
    includePosSession: true,
  });

export const createOrderDelivery = (
  orderId: string,
  payload: CreateDeliveryPayload
) =>
  apiClient<DeliveryRecord>(buildOrderDeliveryEndpoint(orderId), {
    method: "POST",
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const getSaleDelivery = (saleId: string) =>
  apiClient<DeliveryRecord | null>(buildSaleDeliveryEndpoint(saleId));

export const createSaleDelivery = (
  saleId: string,
  payload: CreateDeliveryPayload
) =>
  apiClient<DeliveryRecord>(buildSaleDeliveryEndpoint(saleId), {
    method: "POST",
    includePosSession: true,
    body: JSON.stringify(payload),
  });

export const getDeliveryByOrder = (_tenantId: string, orderId: string) =>
  getOrderDelivery(orderId);

export const createDeliveryFromOrder = (
  _tenantId: string,
  orderId: string,
  payload: CreateDeliveryPayload
) => createOrderDelivery(orderId, payload);

export const getDeliveryBySale = (_tenantId: string, saleId: string) =>
  getSaleDelivery(saleId);

export const createDeliveryFromSale = (
  _tenantId: string,
  saleId: string,
  payload: CreateDeliveryPayload
) => createSaleDelivery(saleId, payload);
