import { apiClient } from "../../lib/http";
import type {
  AccountDetail,
  AccountTenantLink,
  CommercialAccount,
  ContractDetail,
  ContractDraftInput,
  ContractListItem,
  ContractPreview,
  ControlCenterReadiness,
  Paged,
  Plan,
  PlatformTax,
  PriceComponent,
  PriceVersion,
  TenantDirectoryEntry,
} from "./types";

const BASE = "/admin/control-center";

const toQuery = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
};

const post = <T>(url: string, body: unknown, headers?: Record<string, string>) =>
  apiClient<T>(url, { method: "POST", body: JSON.stringify(body ?? {}), headers });

export const getControlCenterReadiness = (signal?: AbortSignal) =>
  apiClient<ControlCenterReadiness>(`${BASE}/readiness`, { method: "GET", signal });

export const listTenantDirectory = (params: { search?: string; cursor?: string | null; limit?: number }, signal?: AbortSignal) =>
  apiClient<{ items: TenantDirectoryEntry[]; nextCursor: string | null }>(
    `${BASE}/tenants${toQuery(params)}`,
    { method: "GET", signal },
  );

export const listAccounts = (params: { search?: string; status?: string; limit?: number; offset?: number }, signal?: AbortSignal) =>
  apiClient<Paged<CommercialAccount>>(`${BASE}/accounts${toQuery(params)}`, { method: "GET", signal });

export const getAccount = (accountId: string, signal?: AbortSignal) =>
  apiClient<AccountDetail>(`${BASE}/accounts/${encodeURIComponent(accountId)}`, { method: "GET", signal });

export const createAccount = (payload: Record<string, unknown>) => post<CommercialAccount>(`${BASE}/accounts`, payload);

export const updateAccount = (accountId: string, payload: Record<string, unknown>) =>
  apiClient<CommercialAccount>(`${BASE}/accounts/${encodeURIComponent(accountId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const linkTenant = (accountId: string, tenantId: string) =>
  post<AccountTenantLink>(`${BASE}/accounts/${encodeURIComponent(accountId)}/tenants`, { tenantId });

export const unlinkTenant = (accountId: string, tenantId: string, reason: string) =>
  post<AccountTenantLink>(
    `${BASE}/accounts/${encodeURIComponent(accountId)}/tenants/${encodeURIComponent(tenantId)}/end`,
    { reason },
  );

export const listPlans = (signal?: AbortSignal) => apiClient<{ items: Plan[] }>(`${BASE}/plans`, { method: "GET", signal });

export const listPlatformTaxes = (signal?: AbortSignal) =>
  apiClient<{ items: PlatformTax[] }>(`${BASE}/plans/taxes`, { method: "GET", signal });

export const createPlan = (payload: { code: string; name: string; description?: string }) => post<Plan>(`${BASE}/plans`, payload);

export const updatePlan = (planId: string, payload: Record<string, unknown>) =>
  apiClient<Plan>(`${BASE}/plans/${encodeURIComponent(planId)}`, { method: "PATCH", body: JSON.stringify(payload) });

export const listPriceVersions = (planId: string, signal?: AbortSignal) =>
  apiClient<{ plan: Plan; versions: PriceVersion[] }>(`${BASE}/plans/${encodeURIComponent(planId)}/price-versions`, {
    method: "GET",
    signal,
  });

export const publishPriceVersion = (
  planId: string,
  payload: {
    validFrom: string;
    taxId: string;
    pricesIncludeTax?: boolean;
    includedPosTerminals: number;
    initialTermMonths?: number;
    defaultTrialMonths?: number;
    components: PriceComponent[];
    reason: string;
  },
) => post<PriceVersion>(`${BASE}/plans/${encodeURIComponent(planId)}/price-versions`, payload);

export const listContracts = (
  params: { status?: string; search?: string; tenantId?: string; accountId?: string; limit?: number; offset?: number },
  signal?: AbortSignal,
) => apiClient<Paged<ContractListItem>>(`${BASE}/contracts${toQuery(params)}`, { method: "GET", signal });

export const getContract = (contractId: string, signal?: AbortSignal) =>
  apiClient<ContractDetail>(`${BASE}/contracts/${encodeURIComponent(contractId)}`, { method: "GET", signal });

export const previewContract = (payload: ContractDraftInput) => post<ContractPreview>(`${BASE}/contracts/preview`, payload);

export const createContract = (payload: ContractDraftInput, idempotencyKey: string) =>
  post<ContractDetail>(`${BASE}/contracts`, payload, { "Idempotency-Key": idempotencyKey });

export const activateContract = (contractId: string, reason: string) =>
  post<ContractDetail>(`${BASE}/contracts/${encodeURIComponent(contractId)}/activate`, { reason });

export const amendContract = (
  contractId: string,
  payload: {
    effectiveFrom: string;
    termPhase: "INITIAL" | "RENEWAL";
    billingFrequency: "MONTHLY" | "ANNUAL";
    extraPosTerminals: number;
    reason: string;
  },
) => post<ContractDetail>(`${BASE}/contracts/${encodeURIComponent(contractId)}/amend`, payload);

export const endContract = (contractId: string, endDate: string, reason: string) =>
  post<ContractDetail>(`${BASE}/contracts/${encodeURIComponent(contractId)}/end`, { endDate, reason });

export const cancelContract = (contractId: string, reason?: string) =>
  post<ContractDetail>(`${BASE}/contracts/${encodeURIComponent(contractId)}/cancel`, reason ? { reason } : {});
