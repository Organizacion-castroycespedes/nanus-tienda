import { apiClient } from "../../../lib/http";
import type {
  CreateDeliveryDriverPayload,
  DeliveryDriver,
  GetDeliveryDriversParams,
  UpdateDeliveryDriverPayload,
} from "../types";

const appendParam = (
  query: URLSearchParams,
  key: string,
  value: string | boolean | undefined | null
) => {
  if (value === undefined || value === null || value === "") {
    return;
  }
  query.set(key, String(value));
};

export const buildDeliveryDriversQuery = (
  params: GetDeliveryDriversParams = {}
) => {
  const query = new URLSearchParams();
  appendParam(query, "query", params.query);
  appendParam(query, "active", params.active);

  const suffix = query.toString();
  return `/delivery-drivers${suffix ? `?${suffix}` : ""}`;
};

export const listDeliveryDrivers = (params: GetDeliveryDriversParams = {}) =>
  apiClient<DeliveryDriver[]>(buildDeliveryDriversQuery(params));

export const createDeliveryDriver = (payload: CreateDeliveryDriverPayload) =>
  apiClient<DeliveryDriver>("/delivery-drivers", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateDeliveryDriver = (
  driverId: string,
  payload: UpdateDeliveryDriverPayload
) =>
  apiClient<DeliveryDriver>(`/delivery-drivers/${driverId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deactivateDeliveryDriver = (driverId: string) =>
  apiClient<DeliveryDriver>(`/delivery-drivers/${driverId}/deactivate`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
