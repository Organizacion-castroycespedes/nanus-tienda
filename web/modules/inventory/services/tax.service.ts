import { apiClient } from "../../../lib/http";

export type TaxResponse = {
  id: string;
  tenantId: string;
  name: string;
  rate: number;
  isIncluded: boolean;
  isActive: boolean;
  taxTypeId?: string | null;
  calculationMethodId?: string | null;
  taxBaseTypeId?: string | null;
  taxTypeCode?: string | null;
  taxTypeDianCode?: string | null;
  calculationMethodCode?: string | null;
  taxBaseTypeCode?: string | null;
};

export type TaxCatalogItem = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  dianCode?: string | null;
  taxCategoryId?: string | null;
  isAlcoholicBeverage?: boolean;
};

export type TaxCatalogsResponse = {
  types: TaxCatalogItem[];
  calculationMethods: TaxCatalogItem[];
  baseTypes: TaxCatalogItem[];
  productCategories: TaxCatalogItem[];
};

export type CreateTaxPayload = {
  name: string;
  rate: number;
  isIncluded: boolean;
  isActive?: boolean;
  taxTypeId?: string | null;
  calculationMethodId?: string | null;
  taxBaseTypeId?: string | null;
  percentageRate?: number | null;
  fixedAmount?: number | null;
  baseQuantity?: number | null;
  baseUnitCode?: string | null;
  taxProductCategoryId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type UpdateTaxPayload = Partial<CreateTaxPayload>;

export const getTaxes = (headers?: HeadersInit) =>
  apiClient<TaxResponse[]>("/taxes", { headers });

export const getTaxCatalogs = (headers?: HeadersInit) =>
  apiClient<TaxCatalogsResponse>("/taxes/catalogs", { headers });

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
