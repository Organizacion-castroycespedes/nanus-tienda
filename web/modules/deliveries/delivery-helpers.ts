import type {
  DeliveryActionKey,
  DeliveryActionPermissionMap,
  DeliveryRecord,
  DeliveryStatus,
} from "./types";

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  DRAFT: "Borrador",
  CREATED: "Creado",
  ASSIGNED: "Asignado",
  DISPATCHED: "Despachado",
  DELIVERED: "Entregado",
  NOT_DELIVERED: "No entregado",
  CANCELLED: "Cancelado",
};

export const finalDeliveryStatuses = new Set<DeliveryStatus>([
  "DELIVERED",
  "NOT_DELIVERED",
  "CANCELLED",
]);

export const isFinalDeliveryStatus = (status: DeliveryStatus) =>
  finalDeliveryStatuses.has(status);

const actionMatrix: Record<DeliveryStatus, DeliveryActionKey[]> = {
  DRAFT: [],
  CREATED: ["assign", "cancel"],
  ASSIGNED: ["dispatch", "cancel"],
  DISPATCHED: ["mark-delivered", "mark-not-delivered"],
  DELIVERED: [],
  NOT_DELIVERED: [],
  CANCELLED: [],
};

export const getDeliveryAvailableActions = (
  status: DeliveryStatus,
  permissions: DeliveryActionPermissionMap
): DeliveryActionKey[] =>
  actionMatrix[status].filter((action) => permissions[action]);

export const deliveryActionLabels: Record<DeliveryActionKey, string> = {
  assign: "Asignar",
  dispatch: "Despachar",
  "mark-delivered": "Marcar entregado",
  "mark-not-delivered": "Marcar no entregado",
  cancel: "Cancelar",
};

export const deliveryActionDescriptions: Record<DeliveryActionKey, string> = {
  assign: "Asigna un usuario repartidor por UUID.",
  dispatch: "Cambia el domicilio asignado a despachado.",
  "mark-delivered": "Cierra el domicilio como entregado.",
  "mark-not-delivered": "Cierra el domicilio como no entregado con motivo.",
  cancel: "Cancela un domicilio creado o asignado con motivo.",
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
