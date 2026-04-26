import { apiClient } from "../../../lib/http";

export type UnitResponse = {
  id: string;
  tenantId: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
};

export type CreateUnitPayload = {
  name: string;
  abbreviation: string;
  isActive?: boolean;
};

export type UpdateUnitPayload = Partial<CreateUnitPayload>;

export const getUnits = (headers?: HeadersInit) =>
  apiClient<UnitResponse[]>("/units", { headers });

export const createUnit = (payload: CreateUnitPayload, headers?: HeadersInit) =>
  apiClient<UnitResponse>("/units", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateUnit = (
  unitId: string,
  payload: UpdateUnitPayload,
  headers?: HeadersInit
) =>
  apiClient<UnitResponse>(`/units/${unitId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

export const deleteUnit = (unitId: string, headers?: HeadersInit) =>
  apiClient<UnitResponse>(`/units/${unitId}`, {
    method: "DELETE",
    headers,
  });
