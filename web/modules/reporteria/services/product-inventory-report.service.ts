import { apiClientWithBaseUrl } from "../../../lib/http";

export type ProductInventoryReportFilters = Partial<Record<
  "tenantId" | "branchId" | "preset" | "search" | "sku" | "code" |
  "categoryId" | "subcategoryId" | "unitId" | "saleType" |
  "measurementUnit" | "operationalStatus" | "stockState" | "minStock" |
  "maxStock" | "lotCode" | "lotPresence" | "expirationFrom" |
  "expirationTo" | "expiredOnly" | "locationId" | "page" | "pageSize", string
>>;

export type ProductInventoryReportPackage = {
  dataset: {
    preset: string;
    generatedAt: string;
    branding: { name: string };
    branchIds: string[];
    rows: unknown[];
    pagination: { page: number; pageSize: number; totalRows: number; totalPages: number };
  };
  pdfBase64: string;
  xlsxBase64?: string;
};

export const createProductInventoryReport = (filters: ProductInventoryReportFilters, mode: "preview" | "export" = "preview") =>
  apiClientWithBaseUrl<ProductInventoryReportPackage>(
    process.env.NEXT_PUBLIC_REPORTS_API_BASE_URL,
    "/reports/product-inventory",
    { method: "POST", body: JSON.stringify({ ...filters, mode }) }
  );

export const reportBase64ToBlob = (base64: string, type: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
};
