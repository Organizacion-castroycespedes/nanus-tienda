import { apiClient } from "../../lib/http";

export type ParameterRecord = {
  id: string;
  code: string;
  value_type: "MODE" | "BOOLEAN";
  default_value: string;
  active: boolean;
  label: string;
  created_at: string;
  updated_at: string;
};

export type TenantSettingRecord = {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  terminal_id: string | null;
  parameter_id: string;
  parameter_code: string;
  parameter_label: string;
  value: string;
  updated_by_user_id: string | null;
  updated_at: string;
};

export type ParameterMode = "DISABLED" | "ON_DEMAND" | "AUTOMATIC";

export const listParameters = (includeInactive = false) =>
  apiClient<ParameterRecord[]>(
    `/parameters${includeInactive ? "?includeInactive=true" : ""}`
  );

export const updateParameter = (
  parameterId: string,
  payload: { label?: string; defaultValue?: string; active?: boolean }
) =>
  apiClient<ParameterRecord>(`/parameters/${parameterId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const createParameter = (payload: {
  code: string;
  valueType: "MODE" | "BOOLEAN";
  defaultValue: string;
  label: string;
  active?: boolean;
}) =>
  apiClient<ParameterRecord>("/parameters", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listTenantSettings = (query: {
  tenantId: string;
  branchId?: string;
  terminalId?: string;
  scope?: "tenant" | "branch" | "terminal";
}) => {
  const params = new URLSearchParams();
  params.set("tenantId", query.tenantId);
  if (query.branchId) params.set("branchId", query.branchId);
  if (query.terminalId) params.set("terminalId", query.terminalId);
  if (query.scope) params.set("scope", query.scope);
  return apiClient<TenantSettingRecord[]>(`/tenant-settings?${params.toString()}`);
};

export const upsertTenantSetting = (payload: {
  tenantId: string;
  branchId?: string | null;
  terminalId?: string | null;
  parameterId?: string;
  parameterCode?: string;
  value: string;
}) =>
  apiClient<TenantSettingRecord>("/tenant-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const resolveTenantSettings = (query: {
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  code?: string;
}) => {
  const params = new URLSearchParams();
  if (query.tenantId) params.set("tenantId", query.tenantId);
  if (query.branchId) params.set("branchId", query.branchId);
  if (query.terminalId) params.set("terminalId", query.terminalId);
  if (query.code) params.set("code", query.code);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiClient<{
    values?: Record<string, string>;
    code?: string;
    value?: string | null;
  }>(`/tenant-settings/resolve${suffix}`);
};
