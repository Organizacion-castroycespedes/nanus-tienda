import { apiClient } from "../../../lib/http";
import type {
  CashMovement,
  CashMovementFilters,
  CashMovementListResponse,
  CashRegister,
  CashRegisterFilters,
  CashSession,
  CashSessionAuditRecord,
  CashSessionSummary,
  CashSessionHistoryFilters,
  CloseCashSessionPayload,
  CreateCashSessionAuditPayload,
  CreateCashMovementPayload,
  CreateCashRegisterPayload,
  CreatePaymentPayload,
  CreatePaymentMethodPayload,
  OpenCashSessionPayload,
  Payment,
  PaymentFilters,
  PaymentMethod,
  PaymentMethodFilters,
  UpdateCashRegisterPayload,
  UpdatePaymentMethodPayload,
} from "../types";

const buildQuery = (params: Record<string, string | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

export const listPaymentMethods = (filters: PaymentMethodFilters = {}) =>
  apiClient<PaymentMethod[]>(
    `/finance/payment-methods${buildQuery({
      tenantId: filters.tenantId,
      active:
        filters.active === undefined ? undefined : String(filters.active),
    })}`
  );

export const createPaymentMethod = (payload: CreatePaymentMethodPayload) =>
  apiClient<PaymentMethod>("/finance/payment-methods", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updatePaymentMethod = (
  paymentMethodId: string,
  payload: UpdatePaymentMethodPayload
) =>
  apiClient<PaymentMethod>(`/finance/payment-methods/${paymentMethodId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deactivatePaymentMethod = (paymentMethodId: string) =>
  apiClient<PaymentMethod>(`/finance/payment-methods/${paymentMethodId}`, {
    method: "DELETE",
  });

export const listCashRegisters = (filters: CashRegisterFilters = {}) =>
  apiClient<CashRegister[]>(
    `/finance/cash-registers${buildQuery({
      tenantId: filters.tenantId,
      branchId: filters.branchId,
      activo:
        filters.activo === undefined ? undefined : String(filters.activo),
    })}`
  );

export const createCashRegister = (payload: CreateCashRegisterPayload) =>
  apiClient<CashRegister>("/finance/cash-registers", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateCashRegister = (
  cashRegisterId: string,
  payload: UpdateCashRegisterPayload
) =>
  apiClient<CashRegister>(`/finance/cash-registers/${cashRegisterId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const openCashSession = (payload: OpenCashSessionPayload) =>
  apiClient<CashSession>("/finance/cash-sessions/open", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const closeCashSession = (
  cashSessionId: string,
  payload: CloseCashSessionPayload
) =>
  apiClient<CashSession>(`/finance/cash-sessions/${cashSessionId}/close`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getCurrentCashSession = (cashRegisterId?: string) =>
  apiClient<CashSession | null>(
    `/finance/cash-sessions/current${buildQuery({
      cashRegisterId,
    })}`
  );

export const listCashSessionHistory = (
  filters: CashSessionHistoryFilters = {}
) =>
  apiClient<CashSession[]>(
    `/finance/cash-sessions/history${buildQuery({
      tenantId: filters.tenantId,
      branchId: filters.branchId,
      cashRegisterId: filters.cashRegisterId,
      status: filters.status,
      limit: filters.limit ? String(filters.limit) : undefined,
      offset: filters.offset ? String(filters.offset) : undefined,
    })}`
  );

export const getCashSessionSummary = (cashSessionId: string) =>
  apiClient<CashSessionSummary>(`/finance/cash-sessions/${cashSessionId}/summary`);

export const getCashSessionAuditPreview = (cashSessionId: string) =>
  apiClient<CashSessionSummary>(
    `/finance/cash-sessions/${cashSessionId}/audit-preview`
  );

export const listCashSessionAudits = (cashSessionId: string) =>
  apiClient<CashSessionAuditRecord[]>(
    `/finance/cash-sessions/${cashSessionId}/audits`
  );

export const createCashSessionAudit = (
  cashSessionId: string,
  payload: CreateCashSessionAuditPayload
) =>
  apiClient<CashSessionAuditRecord>(
    `/finance/cash-sessions/${cashSessionId}/audits`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

export const listCashMovements = (filters: CashMovementFilters = {}) =>
  apiClient<CashMovement[] | CashMovementListResponse>(
    `/finance/cash-movements${buildQuery({
      tenantId: filters.tenantId,
      branchId: filters.branchId,
      cashRegisterId: filters.cashRegisterId,
      cashSessionId: filters.cashSessionId,
      movementType: filters.movementType,
      direction: filters.direction,
      limit: filters.limit ? String(filters.limit) : undefined,
      offset: filters.offset ? String(filters.offset) : undefined,
      includeSummary:
        filters.includeSummary === undefined
          ? undefined
          : String(filters.includeSummary),
    })}`
  );

export const createCashMovement = (payload: CreateCashMovementPayload) =>
  apiClient<CashMovement>("/finance/cash-movements", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listPayments = (filters: PaymentFilters = {}) =>
  apiClient<Payment[]>(
    `/finance/payments${buildQuery({
      tenantId: filters.tenantId,
      branchId: filters.branchId,
      paymentMethodId: filters.paymentMethodId,
      cashSessionId: filters.cashSessionId,
      referenceType: filters.referenceType,
      referenceId: filters.referenceId,
      direction: filters.direction,
      status: filters.status,
      limit: filters.limit ? String(filters.limit) : undefined,
      offset: filters.offset ? String(filters.offset) : undefined,
    })}`
  );

export const createPayment = (payload: CreatePaymentPayload) =>
  apiClient<Payment>("/finance/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
