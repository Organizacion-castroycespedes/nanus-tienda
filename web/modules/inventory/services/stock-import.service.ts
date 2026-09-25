import { apiBlobClient, apiClient } from "../../../lib/http";

export type StockImportAction = "IN" | "OUT" | "NONE";

export type StockImportRowPlan = {
  rowNumber: number;
  sku: string;
  productId: string | null;
  productName: string;
  branchId: string | null;
  branchCode: string;
  lot: {
    lotId: string | null;
    lotCode: string;
    isNew: boolean;
    expirationDate: string | null;
    unitCost: number;
  } | null;
  before: number;
  target: number;
  delta: number;
  action: StockImportAction;
  skipped: boolean;
  errors: string[];
  warnings: string[];
};

export type StockImportReport = {
  rows: StockImportRowPlan[];
  summary: {
    total: number;
    in: number;
    out: number;
    unchanged: number;
    withErrors: number;
    withWarnings: number;
    quantityIn: number;
    quantityOut: number;
  };
  canCommit: boolean;
};

export type StockImportValidation = {
  report: StockImportReport;
  ignoredHeaders: string[];
};

export type StockImportCommitResult = {
  referenceId: string | null;
  summary: {
    total: number;
    in: number;
    out: number;
    unchanged: number;
    quantityIn: number;
    quantityOut: number;
  };
  rows: Array<{
    rowNumber: number;
    sku: string;
    productName: string;
    branchCode: string;
    lotCode: string | null;
    action: StockImportAction;
    skipped: boolean;
    before: number;
    after: number;
    delta: number;
    movementId: string | null;
  }>;
};

const buildFileBody = (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return body;
};

export const downloadStockImportTemplate = (
  params: { branchId?: string; prefill?: boolean } = {},
  headers?: HeadersInit
) => {
  const query = new URLSearchParams();
  if (params.branchId) {
    query.set("branchId", params.branchId);
  }
  if (params.prefill) {
    query.set("prefill", "true");
  }
  const suffix = query.toString();
  return apiBlobClient(`/stock-import/template${suffix ? `?${suffix}` : ""}`, { headers });
};

export const validateStockImport = (file: File, headers?: HeadersInit) =>
  apiClient<StockImportValidation>("/stock-import/validate", {
    method: "POST",
    headers,
    body: buildFileBody(file),
  });

export const commitStockImport = (file: File, headers?: HeadersInit) =>
  apiClient<StockImportCommitResult>("/stock-import/commit", {
    method: "POST",
    headers,
    body: buildFileBody(file),
  });
