import { apiBlobClientWithBaseUrl, apiClient } from "../../../lib/http";
import type {
  ConvertQuotationResponse,
  QuotationDetail,
  QuotationListFilters,
  QuotationListResponse,
  QuotationPayload,
} from "../types";

const reportsBaseUrl = process.env.NEXT_PUBLIC_REPORTS_API_BASE_URL;

export const buildQuotationListQuery = (filters: QuotationListFilters = {}) => {
  const params = new URLSearchParams();
  const entries: Array<[string, string | number | undefined]> = [
    ["search", filters.search?.trim()],
    ["status", filters.status || undefined],
    ["branchId", filters.branchId],
    ["customerId", filters.customerId],
    ["fromDate", filters.fromDate],
    ["toDate", filters.toDate],
    ["page", filters.page],
    ["limit", filters.limit],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `/quotations?${query}` : "/quotations";
};

export const listQuotations = (filters: QuotationListFilters = {}) =>
  apiClient<QuotationListResponse>(buildQuotationListQuery(filters));

export const getQuotation = (id: string) => apiClient<QuotationDetail>(`/quotations/${id}`);

export const createQuotation = (payload: QuotationPayload) =>
  apiClient<QuotationDetail>("/quotations", { method: "POST", body: JSON.stringify(payload) });

export const updateQuotation = (id: string, payload: QuotationPayload) =>
  apiClient<QuotationDetail>(`/quotations/${id}`, { method: "PUT", body: JSON.stringify(payload) });

const postAction = <T = QuotationDetail>(id: string, action: string, body: unknown = {}) =>
  apiClient<T>(`/quotations/${id}/${action}`, { method: "POST", body: JSON.stringify(body) });

export const sendQuotation = (id: string) => postAction(id, "send");

/** Envía el PDF por correo; sin `to` usa el correo del cliente. El PDF no se guarda en el servidor. */
export const sendQuotationEmail = (id: string, payload: { to?: string; message?: string }) =>
  postAction<{ sent: boolean; to: string; quotation: QuotationDetail }>(id, "send-email", payload);
export const approveQuotation = (id: string) => postAction(id, "approve");
export const rejectQuotation = (id: string, reason: string) => postAction(id, "reject", { reason });
export const renewQuotation = (id: string) => postAction(id, "renew");
export const duplicateQuotation = (id: string) => postAction(id, "duplicate");
export const convertQuotationToOrder = (id: string, type: "CASH" | "CREDIT") =>
  postAction<ConvertQuotationResponse>(id, "convert-to-order", { type });

export const getQuotationSettings = () =>
  apiClient<{ defaultValidityDays: number }>("/quotations/settings");

export const updateQuotationSettings = (defaultValidityDays: number) =>
  apiClient<{ defaultValidityDays: number }>("/quotations/settings", {
    method: "PUT",
    body: JSON.stringify({ defaultValidityDays }),
  });

/** PDF con la identidad visual de la cotizacion (backend-reporteria). */
export const getQuotationPdf = (id: string) =>
  apiBlobClientWithBaseUrl(reportsBaseUrl, `/reports/quotations/${id}/pdf`);
