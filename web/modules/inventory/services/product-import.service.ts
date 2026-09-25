import { apiBlobClient, apiClient } from "../../../lib/http";

export type ProductImportAction = "CREATE" | "UPDATE";

export type ProductImportClassificationRef = {
  id: string | null;
  name: string;
  slug: string;
  isNew: boolean;
};

export type ProductImportTaxAssignment = {
  taxId: string;
  name: string;
  calculationOrder: number;
  isIncluded: boolean;
};

export type ProductImportStock = {
  branchId: string;
  branchCode: string;
  quantity: number;
  unitCost: number | null;
  lotCode: string | null;
  expirationDate: string | null;
};

export type ProductImportRowPlan = {
  rowNumber: number;
  sku: string;
  name: string;
  action: ProductImportAction;
  productId: string | null;
  errors: string[];
  warnings: string[];
  unit: { id: string; label: string } | null;
  category: ProductImportClassificationRef | null;
  subcategory: ProductImportClassificationRef | null;
  fiscalCategory: { id: string; code: string; name: string } | null;
  taxes: ProductImportTaxAssignment[] | null;
  product: {
    name: string;
    sku: string;
    price?: number;
    cost?: number;
  };
  priceChanged: boolean;
  barcode: string | null;
  stock: ProductImportStock | null;
};

export type ProductImportReport = {
  rows: ProductImportRowPlan[];
  newCategories: Array<{ name: string; slug: string }>;
  newSubcategories: Array<{
    categorySlug: string;
    categoryName: string;
    name: string;
    slug: string;
  }>;
  summary: {
    total: number;
    create: number;
    update: number;
    withErrors: number;
    withWarnings: number;
    withStock: number;
  };
  canCommit: boolean;
};

export type ProductImportValidation = {
  report: ProductImportReport;
  ignoredHeaders: string[];
};

export type ProductImportRowResult = {
  rowNumber: number;
  sku: string;
  action: ProductImportAction;
  status: "OK" | "FAILED";
  productId: string | null;
  message: string;
};

export type ProductImportCommitResult = {
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    createdCategories: number;
    createdSubcategories: number;
  };
  rows: ProductImportRowResult[];
};

const buildFileBody = (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return body;
};

export const downloadProductImportTemplate = (headers?: HeadersInit) =>
  apiBlobClient("/products/import/template", { headers });

export const validateProductImport = (file: File, headers?: HeadersInit) =>
  apiClient<ProductImportValidation>("/products/import/validate", {
    method: "POST",
    headers,
    body: buildFileBody(file),
  });

export const commitProductImport = (file: File, headers?: HeadersInit) =>
  apiClient<ProductImportCommitResult>("/products/import/commit", {
    method: "POST",
    headers,
    body: buildFileBody(file),
  });
