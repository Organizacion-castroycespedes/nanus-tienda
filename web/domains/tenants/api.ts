import { apiClient } from "../../lib/http";
import type {
  TenantConfigResponse,
  TenantDetailsResponse,
  TenantSummaryResponse,
} from "./dtos";
import type { CompanyDetails } from "../../store/companySlice";
import type { BrandingConfig } from "../../store/brandingSlice";

export const listTenants = () =>
  apiClient<TenantSummaryResponse[]>("/tenants");

export const createTenant = (payload: { slug: string; nombre?: string }) =>
  apiClient<TenantSummaryResponse>("/tenants", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateTenant = (
  tenantId: string,
  payload: { slug?: string; nombre?: string; activo?: boolean }
) =>
  apiClient<TenantSummaryResponse>(`/tenants/${tenantId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const getTenantConfig = (tenantId: string) =>
  apiClient<TenantConfigResponse>(`/tenants/${tenantId}/config`);

export const updateTenantConfig = (tenantId: string, config: BrandingConfig) =>
  apiClient<TenantConfigResponse>(`/tenants/${tenantId}/config`, {
    method: "PUT",
    body: JSON.stringify({ config }),
  });

export const getTenantDetails = (tenantId: string) =>
  apiClient<TenantDetailsResponse>(`/tenants/${tenantId}/details`);

export const updateTenantDetails = (tenantId: string, body: CompanyDetails) =>
  apiClient<TenantDetailsResponse>(`/tenants/${tenantId}/details`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteTenantDetails = (tenantId: string) =>
  apiClient<{ ok: boolean }>(`/tenants/${tenantId}/details`, {
    method: "DELETE",
  });
