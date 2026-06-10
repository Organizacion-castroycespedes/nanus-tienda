import { apiClient } from "../../../lib/http";

export const INVENTORY_LOCATION_TYPES = [
  "WAREHOUSE",
  "DISPLAY",
  "SHELF",
  "COLD_ROOM",
  "COUNTER",
  "OTHER",
] as const;

export type InventoryLocationType = (typeof INVENTORY_LOCATION_TYPES)[number];

export type InventoryLocationResponse = {
  id: string;
  tenantId: string;
  branchId: string;
  code: string;
  name: string;
  type: InventoryLocationType;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListInventoryLocationsParams = {
  branchId?: string;
  type?: InventoryLocationType;
  isActive?: boolean;
  search?: string;
};

export type CreateInventoryLocationPayload = {
  branchId: string;
  code: string;
  name: string;
  type?: InventoryLocationType;
  description?: string | null;
};

export type UpdateInventoryLocationPayload = Partial<
  Omit<CreateInventoryLocationPayload, "branchId">
>;

const buildLocationsQuery = (params: ListInventoryLocationsParams = {}) => {
  const query = new URLSearchParams();

  if (params.branchId) {
    query.set("branchId", params.branchId);
  }
  if (params.type) {
    query.set("type", params.type);
  }
  if (params.isActive !== undefined) {
    query.set("isActive", String(params.isActive));
  }
  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
};

export const listInventoryLocations = (
  params: ListInventoryLocationsParams = {},
  headers?: HeadersInit
) =>
  apiClient<InventoryLocationResponse[]>(`/inventory/locations${buildLocationsQuery(params)}`, {
    headers,
  });

export const getInventoryLocation = (locationId: string, headers?: HeadersInit) =>
  apiClient<InventoryLocationResponse>(`/inventory/locations/${locationId}`, { headers });

export const createInventoryLocation = (
  payload: CreateInventoryLocationPayload,
  headers?: HeadersInit
) =>
  apiClient<InventoryLocationResponse>("/inventory/locations", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateInventoryLocation = (
  locationId: string,
  payload: UpdateInventoryLocationPayload,
  headers?: HeadersInit
) =>
  apiClient<InventoryLocationResponse>(`/inventory/locations/${locationId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

export const deactivateInventoryLocation = (
  locationId: string,
  headers?: HeadersInit
) =>
  apiClient<InventoryLocationResponse>(`/inventory/locations/${locationId}/deactivate`, {
    method: "PATCH",
    headers,
  });
