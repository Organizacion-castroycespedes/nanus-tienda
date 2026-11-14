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
