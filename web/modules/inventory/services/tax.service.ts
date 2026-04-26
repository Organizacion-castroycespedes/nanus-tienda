import { apiClient } from "../../../lib/http";

export type TaxResponse = {
  id: string;
  tenantId: string;
  name: string;
  rate: number;
  isIncluded: boolean;
  isActive: boolean;
};

export type CreateTaxPayload = {
  name: string;
  rate: number;
  isIncluded: boolean;
  isActive?: boolean;
};

export type UpdateTaxPayload = Partial<CreateTaxPayload>;

export const getTaxes = (headers?: HeadersInit) =>
  apiClient<TaxResponse[]>("/taxes", { headers });

export const createTax = (payload: CreateTaxPayload, headers?: HeadersInit) =>
  apiClient<TaxResponse>("/taxes", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateTax = (
  taxId: string,
  payload: UpdateTaxPayload,
  headers?: HeadersInit
) =>
  apiClient<TaxResponse>(`/taxes/${taxId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

export const deleteTax = (taxId: string, headers?: HeadersInit) =>
  apiClient<TaxResponse>(`/taxes/${taxId}`, {
    method: "DELETE",
    headers,
  });
