import { apiClient } from "../../../lib/http";

export type ProductImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export type ProductCategoryResponse = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  defaultImageUrl: string | null;
  defaultImageStorageKey: string | null;
  defaultImageAltText: string | null;
  defaultImageMimeType: ProductImageMimeType | null;
  defaultImageSizeBytes: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductSubcategoryResponse = ProductCategoryResponse & {
  categoryId: string;
};

export type ListProductCategoriesParams = {
  isActive?: boolean;
  search?: string;
};

export type ListProductSubcategoriesParams = ListProductCategoriesParams & {
  categoryId?: string;
};

export type CreateProductCategoryPayload = {
  name: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdateProductCategoryPayload =
  Partial<CreateProductCategoryPayload>;

export type CreateProductSubcategoryPayload = CreateProductCategoryPayload & {
  categoryId: string;
};

export type UpdateProductSubcategoryPayload =
  Partial<CreateProductSubcategoryPayload>;

const buildQuery = (
  params: ListProductCategoriesParams | ListProductSubcategoriesParams = {}
) => {
  const query = new URLSearchParams();
  const withCategory = params as ListProductSubcategoriesParams;

  if (withCategory.categoryId?.trim()) {
    query.set("categoryId", withCategory.categoryId.trim());
  }
  if (params.isActive !== undefined) {
    query.set("isActive", String(params.isActive));
  }
  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
};

export const listProductCategories = (
  params: ListProductCategoriesParams = {}
) =>
  apiClient<ProductCategoryResponse[]>(
    `/inventory/product-categories${buildQuery(params)}`
  );

export const getProductCategory = (categoryId: string) =>
  apiClient<ProductCategoryResponse>(
    `/inventory/product-categories/${categoryId}`
  );

export const createProductCategory = (
  payload: CreateProductCategoryPayload
) =>
  apiClient<ProductCategoryResponse>("/inventory/product-categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateProductCategory = (
  categoryId: string,
  payload: UpdateProductCategoryPayload
) =>
  apiClient<ProductCategoryResponse>(
    `/inventory/product-categories/${categoryId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );

export const activateProductCategory = (categoryId: string) =>
  apiClient<ProductCategoryResponse>(
    `/inventory/product-categories/${categoryId}/activate`,
    { method: "PATCH" }
  );

export const deactivateProductCategory = (categoryId: string) =>
  apiClient<ProductCategoryResponse>(
    `/inventory/product-categories/${categoryId}/deactivate`,
    { method: "PATCH" }
  );

export const listProductSubcategories = (
  params: ListProductSubcategoriesParams = {}
) =>
  apiClient<ProductSubcategoryResponse[]>(
    `/inventory/product-subcategories${buildQuery(params)}`
  );

export const listProductSubcategoriesByCategory = (categoryId: string) =>
  listProductSubcategories({ categoryId });

export const getProductSubcategory = (subcategoryId: string) =>
  apiClient<ProductSubcategoryResponse>(
    `/inventory/product-subcategories/${subcategoryId}`
  );

export const createProductSubcategory = (
  payload: CreateProductSubcategoryPayload
) =>
  apiClient<ProductSubcategoryResponse>("/inventory/product-subcategories", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateProductSubcategory = (
  subcategoryId: string,
  payload: UpdateProductSubcategoryPayload
) =>
  apiClient<ProductSubcategoryResponse>(
    `/inventory/product-subcategories/${subcategoryId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );

export const activateProductSubcategory = (subcategoryId: string) =>
  apiClient<ProductSubcategoryResponse>(
    `/inventory/product-subcategories/${subcategoryId}/activate`,
    { method: "PATCH" }
  );

export const deactivateProductSubcategory = (subcategoryId: string) =>
  apiClient<ProductSubcategoryResponse>(
    `/inventory/product-subcategories/${subcategoryId}/deactivate`,
    { method: "PATCH" }
  );
