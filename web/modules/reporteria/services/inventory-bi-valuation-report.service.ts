import { apiClientWithBaseUrl } from "../../../lib/http";

const reportsBaseUrl = process.env.NEXT_PUBLIC_REPORTS_API_BASE_URL;

export type InventoryValuationExportFilters = {
  tenantId?: string;
  branchId?: string;
  productIds: string[];
  categoryId?: string;
  stockStatus: "all" | "in_stock" | "out_of_stock" | "negative";
};

export type InventoryValuationExportPackage = {
  dataset: {
    generatedAt: string;
    summary: { totalCost: string; totalUnits: string; totalRows: number };
    rows: unknown[];
  };
  pdfBase64: string;
  xlsxBase64?: string;
};

export const createInventoryValuationExport = (
  filters: InventoryValuationExportFilters,
  mode: "preview" | "export",
) => apiClientWithBaseUrl<InventoryValuationExportPackage>(
  reportsBaseUrl,
  "/reports/inventory-bi-valuation",
  { method: "POST", body: JSON.stringify({ ...filters, mode }) },
);

export const base64ToBlob = (base64: string, type: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
};
