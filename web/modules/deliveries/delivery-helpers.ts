import { normalizeDeliveryStatus } from "./types";
import type {
  DeliveryActionKey,
  DeliveryActionPermissionMap,
  DeliveryRecord,
  DeliveryStatus,
} from "./types";

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  CREADO: "Creado",
  EN_PREPARACION: "En preparacion",
  DESPACHADO: "Despachado",
  ENTREGADO: "Entregado",
  NO_ENTREGADO: "No entregado",
  CANCELADO: "Cancelado",
};

export const finalDeliveryStatuses = new Set<DeliveryStatus>([
  "ENTREGADO",
  "CANCELADO",
]);

export const isFinalDeliveryStatus = (status: DeliveryStatus | string) => {
  const operationalStatus = normalizeDeliveryStatus(status);
  return operationalStatus ? finalDeliveryStatuses.has(operationalStatus) : false;
};

export const isDeliveryRetryAllowed = (delivery?: Pick<DeliveryRecord, "metadata">) =>
  delivery?.metadata?.retry_allowed !== false;

const actionMatrix: Record<DeliveryStatus, DeliveryActionKey[]> = {
  CREADO: ["prepare", "dispatch", "cancel"],
  EN_PREPARACION: ["dispatch", "cancel"],
  DESPACHADO: ["mark-delivered", "mark-not-delivered"],
  ENTREGADO: [],
  NO_ENTREGADO: ["dispatch"],
  CANCELADO: [],
};

export const getDeliveryAvailableActions = (
  status: DeliveryStatus | string,
  permissions: DeliveryActionPermissionMap,
  delivery?: Pick<DeliveryRecord, "metadata">
): DeliveryActionKey[] => {
  const operationalStatus = normalizeDeliveryStatus(status);
  if (!operationalStatus) {
    return [];
  }
  if (operationalStatus === "NO_ENTREGADO" && !isDeliveryRetryAllowed(delivery)) {
    return [];
  }

  return actionMatrix[operationalStatus].filter((action) => permissions[action]);
};

export const deliveryActionLabels: Record<DeliveryActionKey, string> = {
  prepare: "Enviar a preparacion",
  dispatch: "Despachar",
  "mark-delivered": "Marcar entregado",
  "mark-not-delivered": "Marcar no entregado",
  cancel: "Cancelar",
};

export const deliveryActionDescriptions: Record<DeliveryActionKey, string> = {
  prepare: "Pasa el domicilio a alistamiento de tienda.",
  dispatch: "Cambia el domicilio a despachado o reintenta un no entregado.",
  "mark-delivered": "Cierra el domicilio como entregado.",
  "mark-not-delivered": "Cierra el domicilio como no entregado con motivo.",
  cancel: "Cancela un domicilio creado o en preparacion con motivo.",
};

export const getDeliveryActionLabel = (
  action: DeliveryActionKey,
  delivery?: Pick<DeliveryRecord, "status">
) => {
  const status = delivery ? normalizeDeliveryStatus(delivery.status) : null;
  if (action === "dispatch" && status === "NO_ENTREGADO") {
    return "Reintentar despacho";
  }
  return deliveryActionLabels[action];
};

export const filterDeliveriesByQuery = (
  deliveries: DeliveryRecord[],
  query: string
) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return deliveries;
  }

  return deliveries.filter((delivery) => {
    const haystack = [
      delivery.customer_name,
      delivery.customer_phone,
      delivery.delivery_address,
      delivery.delivery_reference,
      delivery.delivery_number,
      delivery.order_id,
      delivery.sale_id,
      delivery.driver_id,
      delivery.driver?.name,
      delivery.driver?.phone,
      delivery.driver?.document_number,
      delivery.assigned_courier_id,
      delivery.notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
};

export const getDeliveryFeeSource = (delivery: DeliveryRecord) => {
  const source = delivery.metadata?.delivery_fee_source;
  return typeof source === "string" && source.trim() ? source : "-";
};
