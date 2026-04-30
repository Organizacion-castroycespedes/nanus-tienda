import { apiClient } from "../../../lib/http";

type TerminalApiResponse = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  branch_id: string;
  branch_name: string | null;
  name: string;
  code: string;
  device_fingerprint: string | null;
  is_active: boolean;
  created_at: string;
};

export type TerminalResponse = {
  id: string;
  tenantId: string;
  tenantName: string | null;
  branchId: string;
  branchName: string | null;
  name: string;
  code: string;
  deviceFingerprint: string | null;
  isActive: boolean;
  createdAt: string;
};

export type TerminalFilters = {
  tenantId?: string;
  branchId?: string;
};

export type CreateTerminalPayload = {
  tenantId?: string;
  branchId: string;
  name: string;
  code: string;
  deviceFingerprint?: string;
  isActive?: boolean;
};

export type UpdateTerminalPayload = {
  branchId?: string;
  name?: string;
  code?: string;
  deviceFingerprint?: string | null;
};

const mapTerminal = (item: TerminalApiResponse): TerminalResponse => ({
  id: item.id,
  tenantId: item.tenant_id,
  tenantName: item.tenant_name,
  branchId: item.branch_id,
  branchName: item.branch_name,
  name: item.name,
  code: item.code,
  deviceFingerprint: item.device_fingerprint,
  isActive: item.is_active,
  createdAt: item.created_at,
});

const buildQuery = (filters: TerminalFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.tenantId) {
    params.set("tenantId", filters.tenantId);
  }
  if (filters.branchId) {
    params.set("branchId", filters.branchId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const listTerminals = async (filters: TerminalFilters = {}) => {
  const response = await apiClient<TerminalApiResponse[]>(
    `/terminals${buildQuery(filters)}`
  );
  return response.map(mapTerminal);
};

export const createTerminal = async (payload: CreateTerminalPayload) => {
  const response = await apiClient<TerminalApiResponse>("/terminals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapTerminal(response);
};

export const updateTerminal = async (
  terminalId: string,
  payload: UpdateTerminalPayload
) => {
  const response = await apiClient<TerminalApiResponse>(`/terminals/${terminalId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return mapTerminal(response);
};

export const updateTerminalStatus = async (
  terminalId: string,
  isActive: boolean
) => {
  const response = await apiClient<TerminalApiResponse>(
    `/terminals/${terminalId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }
  );
  return mapTerminal(response);
};
