import { apiBlobClient, apiClient } from "../../lib/http";
import type {
  BillingCollectionsReport,
  RenewalRow,
  AlertsRunResult,
  AlertsStatus,
  Charge,
  ChargeDetail,
  GenerateChargesResult,
  PaymentCatalog,
  Receipt,
  ReceiptDetail,
  ReceivablesSummary,
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

export const voidContract = (contractId: string, reason: string) =>
  post<ContractDetail>(`${BASE}/contracts/${encodeURIComponent(contractId)}/void`, { reason });

export const cancelContract = (contractId: string, reason?: string) =>
  post<ContractDetail>(`${BASE}/contracts/${encodeURIComponent(contractId)}/cancel`, reason ? { reason } : {});

// Fase 2: cargos, recaudos y cartera -------------------------------------------

export const listCharges = (
  params: {
    status?: string;
    kind?: string;
    accountId?: string;
    contractId?: string;
    overdue?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  },
  signal?: AbortSignal,
) =>
  apiClient<Paged<Charge>>(
    `${BASE}/charges${toQuery({ ...params, overdue: params.overdue ? "true" : undefined })}`,
    { method: "GET", signal },
  );

export const getCharge = (chargeId: string, signal?: AbortSignal) =>
  apiClient<ChargeDetail>(`${BASE}/charges/${encodeURIComponent(chargeId)}`, { method: "GET", signal });

export const voidCharge = (chargeId: string, reason: string) =>
  post<ChargeDetail>(`${BASE}/charges/${encodeURIComponent(chargeId)}/void`, { reason });

export const generateCharges = (contractId: string) =>
  post<GenerateChargesResult>(`${BASE}/contracts/${encodeURIComponent(contractId)}/charges/generate`, {});

export const getPaymentCatalog = (signal?: AbortSignal) =>
  apiClient<PaymentCatalog>(`${BASE}/payment-methods`, { method: "GET", signal });

export const listReceipts = (
  params: { accountId?: string; status?: string; source?: string; withBalance?: boolean; search?: string; limit?: number; offset?: number },
  signal?: AbortSignal,
) =>
  apiClient<Paged<Receipt>>(
    `${BASE}/receipts${toQuery({ ...params, withBalance: params.withBalance ? "true" : undefined })}`,
    { method: "GET", signal },
  );

export const getReceipt = (receiptId: string, signal?: AbortSignal) =>
  apiClient<ReceiptDetail>(`${BASE}/receipts/${encodeURIComponent(receiptId)}`, { method: "GET", signal });

export type RegisterReceiptInput = {
  accountId: string;
  receivedOn: string;
  amount: string;
  paymentMethodId: string;
  financialInstitutionId?: string;
  reference?: string;
  notes?: string;
  autoAllocate?: boolean;
  allocations?: { chargeId: string; amount: string }[];
  attachment?: File | null;
};

export const registerReceipt = (input: RegisterReceiptInput, idempotencyKey: string) => {
  const form = new FormData();
  form.set("accountId", input.accountId);
  form.set("receivedOn", input.receivedOn);
  form.set("amount", input.amount);
  form.set("paymentMethodId", input.paymentMethodId);
  if (input.financialInstitutionId) form.set("financialInstitutionId", input.financialInstitutionId);
  if (input.reference) form.set("reference", input.reference);
  if (input.notes) form.set("notes", input.notes);
  if (input.autoAllocate) form.set("autoAllocate", "true");
  if (input.allocations?.length) form.set("allocations", JSON.stringify(input.allocations));
  if (input.attachment) form.set("attachment", input.attachment);
  return apiClient<ReceiptDetail>(`${BASE}/receipts`, { method: "POST", body: form, headers: { "Idempotency-Key": idempotencyKey } });
};

export const allocateReceipt = (receiptId: string, payload: { autoAllocate: true } | { allocations: { chargeId: string; amount: string }[] }) =>
  post<ReceiptDetail>(`${BASE}/receipts/${encodeURIComponent(receiptId)}/allocations`, payload);

export const voidReceipt = (receiptId: string, reason: string) =>
  post<ReceiptDetail>(`${BASE}/receipts/${encodeURIComponent(receiptId)}/void`, { reason });

export const reverseAllocation = (allocationId: string, reason: string) =>
  post<ReceiptDetail>(`${BASE}/allocations/${encodeURIComponent(allocationId)}/reverse`, { reason });

export const downloadReceiptAttachment = (receiptId: string) =>
  apiBlobClient(`${BASE}/receipts/${encodeURIComponent(receiptId)}/attachment`, { method: "GET" });

export const getReceivablesSummary = (asOf?: string, signal?: AbortSignal) =>
  apiClient<ReceivablesSummary>(`${BASE}/receivables/summary${toQuery({ asOf })}`, { method: "GET", signal });

// Fase 3: alertas de cobro -----------------------------------------------------

export const getAlertsStatus = (signal?: AbortSignal) =>
  apiClient<AlertsStatus>(`${BASE}/alerts/status`, { method: "GET", signal });

export const runAlerts = () => post<AlertsRunResult>(`${BASE}/alerts/run`, {});

export const sendTestEmail = (to: string) => post<{ sent: boolean; to: string }>(`${BASE}/alerts/test-email`, { to });

export const remindCharge = (chargeId: string, channel: "EMAIL" | "WHATSAPP" = "EMAIL") =>
  post<{ status: string; stage: string; channel: string; recipient: string }>(`${BASE}/charges/${encodeURIComponent(chargeId)}/remind`, { channel });

export const sendTestWhatsapp = (to: string) => post<{ sent: boolean; to: string }>(`${BASE}/alerts/test-whatsapp`, { to });

export const downloadContractPdf = (contractId: string, versionId?: string) =>
  apiBlobClient(`${BASE}/contracts/${encodeURIComponent(contractId)}/pdf${toQuery({ versionId })}`, { method: "GET" });

// Reportes ---------------------------------------------------------------------

export const downloadAccountStatement = (accountId: string, range: { from?: string; to?: string }) =>
  apiBlobClient(`${BASE}/accounts/${encodeURIComponent(accountId)}/statement${toQuery(range)}`, { method: "GET" });

export const sendAccountStatement = (accountId: string, range: { from?: string; to?: string }) =>
  post<{ sent: boolean; to: string; fileName: string }>(`${BASE}/accounts/${encodeURIComponent(accountId)}/statement/send`, range);

export const getBillingCollections = (range: { from?: string; to?: string }, signal?: AbortSignal) =>
  apiClient<BillingCollectionsReport>(`${BASE}/reports/billing-collections${toQuery(range)}`, { method: "GET", signal });

export const downloadBillingCollectionsXlsx = (range: { from?: string; to?: string }) =>
  apiBlobClient(`${BASE}/reports/billing-collections.xlsx${toQuery(range)}`, { method: "GET" });

export const getRenewals = (days: 30 | 60 | 90, signal?: AbortSignal) =>
  apiClient<{ today: string; days: number; items: RenewalRow[] }>(`${BASE}/reports/renewals${toQuery({ days })}`, { method: "GET", signal });
