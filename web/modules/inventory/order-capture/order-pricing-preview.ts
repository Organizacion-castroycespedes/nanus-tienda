import { apiClient } from "../../../lib/http";

/**
 * Precio informativo de una línea de pedido calculado por el backend
 * (POST /pricing/preview-line, canal ORDER). Al guardar, el backend vuelve a
 * calcular; este valor solo se muestra (HU-SCAN-001, D6).
 */

export type OrderLinePricePreviewPayload = {
  branchId: string;
  productId: string;
  quantity: number;
  channel: "ORDER";
  customerId?: string;
};

export type OrderLinePricePreview = {
  productId: string;
  quantity: number;
  baseUnitPrice: number;
  finalUnitPrice: number;
  discountAmount: number;
  discountPercent: number;
  appliedPromotionName: string | null;
  taxAmount: number;
  lineTotal: number;
};

export const previewOrderLinePrice = (payload: OrderLinePricePreviewPayload) =>
  apiClient<OrderLinePricePreview>("/pricing/preview-line", {
    method: "POST",
    body: JSON.stringify(payload),
  });
