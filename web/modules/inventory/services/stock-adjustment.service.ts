import { apiClient } from "../../../lib/http";

export type CreateStockAdjustmentPayload = {
  productId: string;
  branchId: string;
  type: "IN" | "OUT";
  quantity: number;
  reason: string;
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
