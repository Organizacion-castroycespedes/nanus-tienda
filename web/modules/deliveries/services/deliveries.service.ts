import { apiClient } from "../../../lib/http";
import type {
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
  buildDeliveriesQuery,
  buildOrderDeliveryEndpoint,
  buildSaleDeliveryEndpoint,
} from "./delivery-query";

export {
  buildDeliveriesQuery,
  buildOrderDeliveryEndpoint,
  buildSaleDeliveryEndpoint,
};

export const listDeliveries = (params: GetDeliveriesParams = {}) =>
  apiClient<DeliveryListResponse>(buildDeliveriesQuery(params));

export const getDeliveryById = (deliveryId: string) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}`);

export const createDelivery = (payload: CreateDeliveryPayload) =>
  apiClient<DeliveryRecord>("/deliveries", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateDelivery = (
  deliveryId: string,
  payload: Partial<CreateDeliveryPayload>
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const assignDelivery = (
  deliveryId: string,
  payload: AssignDeliveryPayload
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/assign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const prepareDelivery = (
  deliveryId: string,
  payload: AssignDeliveryPayload = {}
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/prepare`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const dispatchDelivery = (
  deliveryId: string,
  payload: DispatchDeliveryPayload = {}
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/dispatch`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const markDeliveryDelivered = (
  deliveryId: string,
  payload: MarkDeliveryDeliveredPayload = {}
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/mark-delivered`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const markDeliveryNotDelivered = (
  deliveryId: string,
  payload: MarkDeliveryNotDeliveredPayload
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/mark-not-delivered`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const cancelDelivery = (
  deliveryId: string,
  payload: CancelDeliveryPayload
) =>
  apiClient<DeliveryRecord>(`/deliveries/${deliveryId}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getOrderDelivery = (orderId: string) =>
  apiClient<DeliveryRecord | null>(buildOrderDeliveryEndpoint(orderId));

export const createOrderDelivery = (
  orderId: string,
  payload: CreateDeliveryPayload
) =>
  apiClient<DeliveryRecord>(buildOrderDeliveryEndpoint(orderId), {
    method: "POST",
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
