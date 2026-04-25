import { apiClient } from "../../lib/http";
import type { BranchResponse } from "./dtos";
import type { BranchStatus } from "./types";

export type BranchCreatePayload = {
  tenantId?: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  esPrincipal?: boolean;
  direccion?: string;
  paisId?: string;
  departamentoId?: string;
  municipioId?: string;
  telefono?: string;
  email?: string;
  estado?: BranchStatus;
  metadata?: Record<string, unknown>;
};

export type BranchUpdatePayload = {
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  esPrincipal?: boolean;
  direccion?: string;
  paisId?: string;
  departamentoId?: string;
  municipioId?: string;
  telefono?: string;
  email?: string;
  estado?: BranchStatus;
  metadata?: Record<string, unknown>;
};

export const listBranches = (
  params: { tenantId?: string } = {},
  headers?: HeadersInit
) => {
  const query = params.tenantId ? `?tenantId=${params.tenantId}` : "";
  return apiClient<BranchResponse[]>(`/branches${query}`, { headers });
};

export const getBranch = (branchId: string, headers?: HeadersInit) =>
  apiClient<BranchResponse>(`/branches/${branchId}`, { headers });

export const createBranch = (
  payload: BranchCreatePayload,
  headers?: HeadersInit
) =>
  apiClient<BranchResponse>("/branches", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateBranch = (
  branchId: string,
  payload: BranchUpdatePayload,
  headers?: HeadersInit
) =>
  apiClient<BranchResponse>(`/branches/${branchId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

export const updateBranchStatus = (
  branchId: string,
  estado: BranchStatus,
  headers?: HeadersInit
) =>
  apiClient<BranchResponse>(`/branches/${branchId}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ estado }),
  });
