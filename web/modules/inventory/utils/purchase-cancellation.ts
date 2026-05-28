import type { PurchaseResponse } from "../services/purchase.service";

export const isPurchaseCancelable = (
  purchase: Pick<PurchaseResponse, "status" | "totalPaid" | "paymentStatus">,
  canCancel: boolean
) =>
  canCancel &&
  (purchase.status === "DRAFT" || purchase.status === "PENDING") &&
  purchase.totalPaid <= 0 &&
  purchase.paymentStatus === "PENDING";
