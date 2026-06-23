import type { DeliveryRecord } from "./types";

export type DeliveryCashScope = "current" | "none" | "other";

export const hasDeliveryCashImpact = (delivery: Pick<DeliveryRecord, "delivery_fee" | "payment_method_id">) =>
  Number(delivery.delivery_fee ?? 0) > 0 || Boolean(delivery.payment_method_id);

export const getDeliveryCashScope = (
  delivery: Pick<DeliveryRecord, "cash_session_id">,
  currentCashSessionId?: string | null
): DeliveryCashScope => {
  if (!delivery.cash_session_id) {
    return "none";
  }
  if (currentCashSessionId && delivery.cash_session_id === currentCashSessionId) {
    return "current";
  }
  return "other";
};

export const getDeliveryCashScopeLabel = (scope: DeliveryCashScope) => {
  if (scope === "current") {
    return "Caja actual";
  }
  if (scope === "other") {
    return "Otra caja";
  }
  return "Sin caja";
};

export const shouldBlockCashImpactAction = (
  delivery: Pick<DeliveryRecord, "delivery_fee" | "payment_method_id" | "cash_session_id">,
  currentCashSessionId?: string | null
) => {
  if (!hasDeliveryCashImpact(delivery)) {
    return false;
  }
  if (!currentCashSessionId) {
    return true;
  }
  return Boolean(delivery.cash_session_id && delivery.cash_session_id !== currentCashSessionId);
};
