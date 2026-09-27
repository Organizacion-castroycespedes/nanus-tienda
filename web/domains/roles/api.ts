import { apiClient } from "../../lib/http";
import type { RoleResponse, RoleUserResponse } from "./dtos";

export type RoleCreatePayload = {
  nombre: string;
  descripcion?: string;
  tenantIds?: string[];
};

export type RoleUpdatePayload = {
  nombre?: string;
  descripcion?: string;
  tenantIds?: string[];
};

export const listRoles = (headers?: HeadersInit) =>
  apiClient<RoleResponse[]>("/roles", { headers });

export const getRoleUsers = (
  roleId: string,
  tenantId?: string,
  headers?: HeadersInit
) => {
  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  return apiClient<RoleUserResponse[]>(`/roles/${roleId}/users${query}`, {
    headers,
  });
};

export const createRole = (
  payload: RoleCreatePayload,
  headers?: HeadersInit
) =>
  apiClient<RoleResponse>("/roles", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateRole = (
  roleId: string,
  payload: RoleUpdatePayload,
  headers?: HeadersInit
) =>
  apiClient<RoleResponse>(`/roles/${roleId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
