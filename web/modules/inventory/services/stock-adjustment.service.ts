import { apiClient } from "../../../lib/http";

export type CreateStockAdjustmentPayload = {
  productId: string;
  branchId: string;
  type: "IN" | "OUT";
  quantity: number;
  reason: string;
  lotCode?: string | null;
  lotId?: string | null;
  expirationDate?: string | null;
  locationId?: string | null;
  unitCost?: number;
  /** Entrada de producto con serie: series nuevas. */
  serialNumbers?: string[];
  /** Salida de producto con serie: series que se dan de baja. */
  serialIds?: string[];
};

export const createStockAdjustment = (
  payload: CreateStockAdjustmentPayload,
  headers?: HeadersInit
) =>
  apiClient<void>("/stock-adjustments", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
