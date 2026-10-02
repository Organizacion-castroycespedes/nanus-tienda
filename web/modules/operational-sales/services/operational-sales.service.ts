import { apiClient } from "../../../lib/http";
import type { ElectronicBillingOnlineResult } from "../../reporteria/services/electronic-billing.service";
import type {
  OperationalSaleDetail,
  OperationalSaleListItem,
  OperationalSalesFilters,
  OperationalSalesResponse,
} from "../types";

export type OperationalSalesRequest = {
  page: number;
  limit: number;
  sortBy: "createdAt" | "total" | "status";
  sortDirection: "ASC" | "DESC";
  filters: OperationalSalesFilters;
};

export const isEligibleForElectronicBillingRequest = (
  sale: Pick<OperationalSaleListItem, "status" | "paymentStatus" | "electronicBilling" | "customer">
) =>
  (!sale.electronicBilling ||
    !["PENDING", "PROCESSING", "ACCEPTED"].includes(sale.electronicBilling.status)) &&
  sale.status === "CONFIRMED" &&
  ["PAID", "OVERPAID"].includes(sale.paymentStatus) &&
  Boolean(sale.customer?.id);

export const fetchOperationalSales = (request: OperationalSalesRequest) => {
  const params = new URLSearchParams({
    page: String(request.page),
    limit: String(request.limit),
    sortBy: request.sortBy,
    sortDirection: request.sortDirection,
  });

  Object.entries(request.filters).forEach(([key, value]) => {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  });

  return apiClient<OperationalSalesResponse>(
    `/operations/sales?${params.toString()}`,
    { includePosSession: true },
  );
};

export const fetchOperationalSaleDetail = (saleId: string) =>
  apiClient<OperationalSaleDetail>(
    `/operations/sales/${encodeURIComponent(saleId)}`,
    { includePosSession: true },
  );

export const refreshOperationalSaleBillingStatus = (saleId: string) =>
  apiClient<OperationalSaleDetail>(
    `/operations/sales/${encodeURIComponent(saleId)}/electronic-billing/refresh`,
    { method: "POST", includePosSession: true },
  );

export type ElectronicBillingRequestResult = {
  saleId: string;
  result: string;
  eligibility: string;
  message?: string;
  requestCreated: boolean;
  electronicDocumentId: string | null;
};

export const requestOperationalSaleElectronicBilling = (saleId: string) =>
  apiClient<ElectronicBillingRequestResult>(
    `/sales/${encodeURIComponent(saleId)}/electronic-billing`,
    { method: "POST", includePosSession: true },
  );

export const retryOperationalSaleBilling = (saleId: string) =>
  apiClient<OperationalSaleDetail>(
    `/operations/sales/${encodeURIComponent(saleId)}/electronic-billing/retry`,
    { method: "POST", includePosSession: true },
  );

export const recoverOperationalSaleProviderCreateIntent = (saleId: string) =>
  apiClient<OperationalSaleDetail>(
    `/operations/sales/${encodeURIComponent(saleId)}/electronic-billing/recover-provider-create-intent`,
    { method: "POST", includePosSession: true },
  );

export const shouldShowProviderCreateIntentRecovery = (
  sale: Pick<OperationalSaleDetail, "electronicBilling">,
  canWrite: boolean,
) => canWrite && (
  sale.electronicBilling?.retryability?.canRecoverProviderCreateIntent === true
  || sale.electronicBilling?.retryability?.canRecoverExistingProvider === true
);

export type OperationalSaleVoidAvailability =
  | { kind: "HIDDEN"; message: null }
  | { kind: "LOCAL"; message: null }
  | { kind: "CREDIT_NOTE"; message: null }
  | { kind: "BLOCKED_ELECTRONIC"; message: string };

const electronicBillingStatusLabels: Record<string, string> = {
  PENDING: "pendiente",
  PROCESSING: "en procesamiento",
  REJECTED: "rechazada",
  TECHNICAL_ERROR: "con error técnico",
  CANCELLED: "cancelada",
};

export const resolveOperationalSaleVoidAvailability = (
  sale: Pick<OperationalSaleDetail, "status" | "electronicBilling">,
): OperationalSaleVoidAvailability => {
  if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
    return { kind: "HIDDEN", message: null };
  }
  if (!sale.electronicBilling) {
    return { kind: "LOCAL", message: null };
  }
  if (sale.electronicBilling.status === "ACCEPTED") {
    return { kind: "CREDIT_NOTE", message: null };
  }

  const status = electronicBillingStatusLabels[sale.electronicBilling.status]
    ?? sale.electronicBilling.status.toLowerCase();
  return {
    kind: "BLOCKED_ELECTRONIC",
    message: `No se puede anular esta venta porque la factura electrónica está ${status}. Primero actualiza o reconcilia su estado fiscal. Solo una factura aceptada puede anularse mediante nota crédito.`,
  };
};

export const PROVIDER_CREATE_INTENT_RECOVERY_CONFIRMATION =
  "Manus verificar\u00e1 primero si el documento ya existe en FactuCore. Si lo encuentra, reutilizar\u00e1 ese documento; si no, continuar\u00e1 el procesamiento seguro y podr\u00eda avanzar hacia la DIAN. No ejecutes esta acci\u00f3n varias veces.";

export const providerCreateIntentRecoveryMessage = (
  resultCode: "REMOTE_FOUND_RECONCILED" | "REMOTE_NOT_FOUND_RECOVERED" | "EXISTING_PROVIDER_RECONCILED",
) => resultCode === "REMOTE_FOUND_RECONCILED"
  ? "Se encontr\u00f3 y reconcili\u00f3 el documento existente en FactuCore."
  : resultCode === "EXISTING_PROVIDER_RECONCILED"
    ? "Se reutiliz\u00f3 el documento existente en FactuCore y se continu\u00f3 su procesamiento."
  : "FactuCore confirm\u00f3 que el documento no exist\u00eda. El procesamiento continuar\u00e1 de forma segura.";

export const createSinglePostGuard = () => {
  let pending = false;
  return {
    run: async <T>(operation: () => Promise<T>) => {
      if (pending) {
        return { started: false as const };
      }
      pending = true;
      try {
        return { started: true as const, value: await operation() };
      } finally {
        pending = false;
      }
    },
  };
};

export const updateOperationalSaleCustomer = (saleId: string, customerId: string) =>
  apiClient<OperationalSaleDetail>(
    `/operations/sales/${encodeURIComponent(saleId)}/customer`,
    {
      method: "PATCH",
      includePosSession: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    },
  );

export type CorrectOperationalSalePaymentsPayload = {
  reason: string;
  payments: Array<{
    paymentMethodId: string;
    amount: number;
    reference?: string | null;
    financialInstitutionId?: string | null;
  }>;
};

export const correctOperationalSalePayments = (
  saleId: string,
  payload: CorrectOperationalSalePaymentsPayload,
) =>
  apiClient<OperationalSaleDetail>(
    `/operations/sales/${encodeURIComponent(saleId)}/payment-correction`,
    {
      method: "POST",
      includePosSession: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

export type VoidOperationalSalePayload = {
  reason: string;
  discrepancyResponseCode?: string;
  discrepancyResponseDescription?: string;
  returnInventory?: boolean;
};

export type SaleVoidRequestSummary = {
  id: string | null;
  status: "PENDING_CREDIT_NOTE";
  attemptCount: number;
  nextAttemptAt: string | null;
  message: string;
};

export type VoidOperationalSaleResult = OperationalSaleDetail & {
  creditNote?: ElectronicBillingOnlineResult | null;
  voidRequest?: SaleVoidRequestSummary | null;
};

export const voidOperationalSale = (
  saleId: string,
  payload: VoidOperationalSalePayload,
) =>
  apiClient<VoidOperationalSaleResult>(
    `/operations/sales/${encodeURIComponent(saleId)}/void`,
    {
      method: "POST",
      includePosSession: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

export type OperationalDebitNotePayload = {
  reason: string;
  discrepancyResponseCode: string;
  discrepancyResponseDescription?: string;
  amount: number;
};

export const issueOperationalDebitNote = (
  saleId: string,
  payload: OperationalDebitNotePayload,
) =>
  apiClient<OperationalSaleDetail>(
    `/operations/sales/${encodeURIComponent(saleId)}/debit-note`,
    {
      method: "POST",
      includePosSession: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

