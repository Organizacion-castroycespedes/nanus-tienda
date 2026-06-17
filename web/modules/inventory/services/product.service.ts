import { apiClient } from "../../../lib/http";
import type {
  ProductBarcode,
  ProductBarcodeType,
  ProductMeasurementUnit,
  ProductPriceChangeResponse,
  ProductPriceHistoryEntry,
  ProductOperationalStatus,
  ProductResponse,
  ProductRotationClass,
  ProductSaleType,
} from "../../../domains/products/dtos";

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
  isPerishable?: boolean;
  requiresLot?: boolean;
  requiresExpiration?: boolean;
  operationalStatus?: ProductOperationalStatus;
  rotationClass?: ProductRotationClass | null;
  saleType?: ProductSaleType;
  measurementUnit?: ProductMeasurementUnit;
  minStock?: number | null;
  maxStock?: number | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

export type ChangeProductPricePayload = {
  newPrice: number;
  reason: string;
};

export type CreateProductBarcodePayload = {
  barcode: string;
  barcodeType?: ProductBarcodeType;
  isPrimary?: boolean;
};

export type UpdateProductBarcodePayload = Partial<CreateProductBarcodePayload>;

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

export const uploadProductImage = (
  productId: string,
  file: File,
  altText?: string | null,
  headers?: HeadersInit
) => {
  const body = new FormData();
  body.append("file", file);
  if (altText?.trim()) {
    body.append("altText", altText.trim());
  }

  return apiClient<ProductResponse>(`/inventory/products/${productId}/image`, {
    method: "POST",
    headers,
    body,
  });
};

export const deleteProductImage = (
  productId: string,
  headers?: HeadersInit
) =>
  apiClient<ProductResponse>(`/inventory/products/${productId}/image`, {
    method: "DELETE",
    headers,
  });

export const deleteProduct = (productId: string, headers?: HeadersInit) =>
  apiClient<void>(`/products/${productId}`, {
    method: "DELETE",
    headers,
  });

export const getProductPriceHistory = (
  productId: string,
  headers?: HeadersInit
) =>
  apiClient<ProductPriceHistoryEntry[]>(
    `/products/${productId}/price-history`,
    { headers }
  );

export const changeProductPrice = (
  productId: string,
  payload: ChangeProductPricePayload,
  headers?: HeadersInit
) =>
  apiClient<ProductPriceChangeResponse>(`/products/${productId}/change-price`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const listProductBarcodes = (productId: string, headers?: HeadersInit) =>
  apiClient<ProductBarcode[]>(`/products/${productId}/barcodes`, { headers });

export const createProductBarcode = (
  productId: string,
  payload: CreateProductBarcodePayload,
  headers?: HeadersInit
) =>
  apiClient<ProductBarcode>(`/products/${productId}/barcodes`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export const updateProductBarcode = (
  productId: string,
  barcodeId: string,
  payload: UpdateProductBarcodePayload,
  headers?: HeadersInit
) =>
  apiClient<ProductBarcode>(`/products/${productId}/barcodes/${barcodeId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

export const deactivateProductBarcode = (
  productId: string,
  barcodeId: string,
  headers?: HeadersInit
) =>
  apiClient<ProductBarcode>(`/products/${productId}/barcodes/${barcodeId}/deactivate`, {
    method: "PATCH",
    headers,
  });

export const setPrimaryProductBarcode = (
  productId: string,
  barcodeId: string,
  headers?: HeadersInit
) =>
  apiClient<ProductBarcode>(`/products/${productId}/barcodes/${barcodeId}/set-primary`, {
    method: "PATCH",
    headers,
  });
