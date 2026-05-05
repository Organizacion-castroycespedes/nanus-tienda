import { apiClient } from "../../../lib/http";
import type { ProductResponse } from "../../../domains/products/dtos";

export type GetProductsParams = {
  search?: string;
  page?: number;
  pageSize?: number;
  branchId?: string;
};

export type GetInventoryProductsParams = {
  tenantId?: string;
  branchId?: string;
};

export type CreateProductPayload = {
  name: string;
  sku: string;
  price: number;
  cost: number;
  unitId: string;
  taxId?: string | null;
  description?: string | null;
  priceWithTax?: number;
  priceWithoutTax?: number;
  isActive?: boolean;
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

const buildProductsQuery = (params: GetProductsParams = {}) => {
  const searchParams = new URLSearchParams();

  if (params.search) {
    searchParams.set("search", params.search);
  }
  if (typeof params.page === "number") {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.pageSize === "number") {
    searchParams.set("pageSize", String(params.pageSize));
  }
  if (params.branchId) {
    searchParams.set("branchId", params.branchId);
  }

  const query = searchParams.toString();
  return query ? `/products?${query}` : "/products";
};

export const getProducts = (
  params: GetProductsParams = {},
  headers?: HeadersInit
) => apiClient<ProductResponse[]>(buildProductsQuery(params), { headers });

export const getInventoryProducts = (
  params: GetInventoryProductsParams = {},
  headers?: HeadersInit
) => {
  const query = new URLSearchParams();
  if (params.tenantId) {
    query.set("tenantId", params.tenantId);
  }
  if (params.branchId) {
    query.set("branchId", params.branchId);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiClient<ProductResponse[]>(`/inventory/products${suffix}`, { headers });
};

export const createProduct = (
  payload: CreateProductPayload,
  headers?: HeadersInit
) =>
  apiClient<ProductResponse>("/products", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateProduct = (
  productId: string,
  payload: UpdateProductPayload,
  headers?: HeadersInit
) =>
  apiClient<ProductResponse>(`/products/${productId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

export const deleteProduct = (productId: string, headers?: HeadersInit) =>
  apiClient<void>(`/products/${productId}`, {
    method: "DELETE",
    headers,
  });
