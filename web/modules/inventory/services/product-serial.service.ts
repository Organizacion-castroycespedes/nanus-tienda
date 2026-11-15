import { apiClient } from "../../../lib/http";

export type SerialPrevalidationResponse = {
  total: number;
  valid: string[];
  invalidFormat: string[];
  duplicatesInPayload: string[];
  alreadyRegistered: Array<{ serialNumber: string; status: string }>;
  existsInOtherProduct: Array<{ serialNumber: string; productName: string; productSku: string }>;
  ok: boolean;
};

/** Prevalida series antes de recibir (formato, repetidas y ya registradas en el producto). */
export const validateSerials = (
  payload: { productId: string; branchId: string; serialNumbers: string[] },
  headers?: HeadersInit
) =>
  apiClient<SerialPrevalidationResponse>("/inventory/serials/validate", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

export type ProductSerialListItem = {
  id: string;
  productId: string;
  serialNumber: string;
  status: string;
  branchId: string;
  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;
};

/** Series disponibles de un producto en una sucursal (POS y entregas). */
export const listAvailableSerials = (
  params: { productId: string; branchId: string; search?: string; limit?: number },
  headers?: HeadersInit
) => {
  const query = new URLSearchParams({ productId: params.productId, branchId: params.branchId });
  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }
  if (params.limit) {
    query.set("limit", String(params.limit));
  }
  return apiClient<{ items: ProductSerialListItem[]; total: number }>(
    `/inventory/serials/available?${query.toString()}`,
    { headers }
  );
};

export type ProductSerialStatus = "AVAILABLE" | "SOLD" | "RETURNED" | "BLOCKED" | "WRITTEN_OFF";

export type ProductSerialDetail = ProductSerialListItem & {
  productName: string | null;
  productSku: string | null;
  branchName: string | null;
  capturedSerialNumber: string;
  sourceType: string;
  purchaseId: string | null;
  saleId: string | null;
  orderId: string | null;
  customerId: string | null;
  receivedAt: string | null;
  soldAt: string | null;
};

export type ProductSerialEvent = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  branchId: string | null;
  fromLocationCode: string | null;
  toLocationCode: string | null;
  referenceType: string | null;
  referenceId: string | null;
  stockMovementId: string | null;
  userId: string | null;
  reason: string | null;
  createdAt: string | null;
};

/** Búsqueda de series (página /inventory/serials). */
export const searchSerials = (
  params: {
    search?: string;
    productId?: string;
    branchId?: string;
    status?: ProductSerialStatus | "";
    limit?: number;
    offset?: number;
  },
  headers?: HeadersInit
) => {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.productId) query.set("productId", params.productId);
  if (params.branchId) query.set("branchId", params.branchId);
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  const suffix = query.toString();
  return apiClient<{ items: ProductSerialDetail[]; total: number; limit: number; offset: number }>(
    `/inventory/serials${suffix ? `?${suffix}` : ""}`,
    { headers }
  );
};

export const getSerialHistory = (serialId: string, headers?: HeadersInit) =>
  apiClient<{ serial: ProductSerialDetail; events: ProductSerialEvent[] }>(
    `/inventory/serials/${serialId}/history`,
    { headers }
  );

/** Inspección o bloqueo: AVAILABLE, BLOCKED o WRITTEN_OFF (con ajuste de salida). */
export const inspectSerial = (
  serialId: string,
  payload: { result: "AVAILABLE" | "BLOCKED" | "WRITTEN_OFF"; reason: string },
  headers?: HeadersInit
) =>
  apiClient<ProductSerialDetail | null>(`/inventory/serials/${serialId}/inspect`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

/** Mueve series de ubicación (sin movimiento de kardex). */
export const moveSerialsLocation = (
  payload: { serialIds: string[]; locationId: string | null; reason?: string },
  headers?: HeadersInit
) =>
  apiClient<{ moved: number }>("/inventory/serials/location", {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });

/** Lee series desde un archivo .csv, .txt o .xlsx (columna "serie" o la primera). */
export const parseSerialFile = (file: File, headers?: HeadersInit) => {
  const body = new FormData();
  body.append("file", file);
  return apiClient<{ serialNumbers: string[] }>("/inventory/serials/parse", {
    method: "POST",
    headers,
    body,
  });
};
