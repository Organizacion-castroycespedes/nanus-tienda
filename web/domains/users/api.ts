import { apiClient } from "../../lib/http";
import type { CreateUserDto, UpdateUserDto, UserResponse } from "./dtos";

export type ListUsersParams = {
  tenantId?: string;
  query?: string;
  estado?: string;
  limit?: number;
  offset?: number;
};

const buildQuery = (params: ListUsersParams) => {
  const query = new URLSearchParams();
  if (params.tenantId) {
    query.set("tenantId", params.tenantId);
  }
  if (params.query) {
    query.set("query", params.query);
  }
  if (params.estado) {
    query.set("estado", params.estado);
  }
  if (params.limit) {
    query.set("limit", String(params.limit));
  }
  if (params.offset) {
    query.set("offset", String(params.offset));
  }
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
};

export const listUsers = (params: ListUsersParams, headers?: HeadersInit) =>
  apiClient<UserResponse[]>(`/users${buildQuery(params)}`, { headers });

export const getUser = (userId: string, headers?: HeadersInit) =>
  apiClient<UserResponse>(`/users/${userId}`, { headers });

export const createUser = (payload: CreateUserDto, headers?: HeadersInit) =>
  apiClient<UserResponse>("/users", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateUser = (
  userId: string,
  payload: UpdateUserDto,
  headers?: HeadersInit
) =>
  apiClient<UserResponse>(`/users/${userId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });

export const updateUserPassword = (
  userId: string,
  password: string,
  headers?: HeadersInit
) =>
  apiClient<{ ok: boolean }>(`/users/${userId}/password`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ password }),
  });
