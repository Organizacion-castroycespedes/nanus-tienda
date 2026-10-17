import { apiClient } from "../../lib/http";
import type {
  CreateElectronicBillingProviderInput,
  ElectronicBillingProviderCatalog,
  ElectronicBillingProviderMutation,
  ElectronicBillingTenantConfigurationResponse,
  ElectronicBillingFactuCoreContextResponse,
  ElectronicBillingRuntimeCryptoReadiness,
  UpdateElectronicBillingProviderInput,
} from "./types";

export const listElectronicBillingProviders = (signal?: AbortSignal) =>
  apiClient<ElectronicBillingProviderCatalog>(
    "/admin/electronic-billing/providers",
    { method: "GET", signal },
  );

export const createElectronicBillingProvider = (
  payload: CreateElectronicBillingProviderInput,
) =>
  apiClient<ElectronicBillingProviderMutation>(
    "/admin/electronic-billing/providers",
    { method: "POST", body: JSON.stringify(payload) },
  );

export const updateElectronicBillingProvider = (
  providerId: string,
  payload: UpdateElectronicBillingProviderInput,
) =>
  apiClient<ElectronicBillingProviderMutation>(
    `/admin/electronic-billing/providers/${encodeURIComponent(providerId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );

export const updateElectronicBillingProviderStatus = (
  providerId: string,
  active: boolean,
) =>
  apiClient<ElectronicBillingProviderMutation>(
    `/admin/electronic-billing/providers/${encodeURIComponent(providerId)}/status`,
    { method: "PATCH", body: JSON.stringify({ active }) },
  );

export const getElectronicBillingTenantConfiguration = (
  tenantId: string,
  signal?: AbortSignal,
) =>
  apiClient<ElectronicBillingTenantConfigurationResponse>(
    `/admin/electronic-billing/tenants/${encodeURIComponent(tenantId)}/config`,
    { method: "GET", signal },
  );

export const getElectronicBillingFactuCoreContext = (
  tenantId: string,
  signal?: AbortSignal,
) =>
  apiClient<ElectronicBillingFactuCoreContextResponse>(
    `/admin/electronic-billing/tenants/${encodeURIComponent(tenantId)}/factucore-context`,
    { method: "GET", signal },
  );

export const getElectronicBillingRuntimeCryptoReadiness = (
  signal?: AbortSignal,
) =>
  apiClient<ElectronicBillingRuntimeCryptoReadiness>(
    "/admin/electronic-billing/runtime/crypto-readiness",
    { method: "GET", signal, cache: "no-store" },
  );

export const createElectronicBillingTenantConfiguration = (
  tenantId: string,
  payload: {
    providerId: string;
    environment: "TEST" | "HABILITATION" | "PRODUCTION";
    baseUrl?: string | null;
    settings?: { factuCoreTenantId?: string | null };
    clientKey: string;
    clientSecret: string;
  },
) =>
  apiClient(`/admin/electronic-billing/tenants/${encodeURIComponent(tenantId)}/config`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateElectronicBillingTenantConfiguration = (
  tenantId: string,
  configId: string,
  payload: {
    baseUrl?: string | null;
    settings?: { factuCoreTenantId?: string | null };
    clientKey?: string;
    clientSecret?: string;
  },
) =>
  apiClient(`/admin/electronic-billing/tenants/${encodeURIComponent(tenantId)}/config/${encodeURIComponent(configId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const activateElectronicBillingTenantConfiguration = (
  tenantId: string,
  configId: string,
) =>
  apiClient(`/admin/electronic-billing/tenants/${encodeURIComponent(tenantId)}/config/${encodeURIComponent(configId)}/activate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
