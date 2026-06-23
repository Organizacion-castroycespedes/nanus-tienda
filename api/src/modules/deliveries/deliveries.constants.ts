export const DELIVERY_STATUSES = [
  "CREADO",
  "EN_PREPARACION",
  "DESPACHADO",
  "ENTREGADO",
  "NO_ENTREGADO",
  "CANCELADO",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const LEGACY_DELIVERY_STATUSES = [
  "DRAFT",
  "CREATED",
  "ASSIGNED",
  "DISPATCHED",
  "DELIVERED",
  "NOT_DELIVERED",
  "CANCELLED",
] as const;

export type LegacyDeliveryStatus = (typeof LEGACY_DELIVERY_STATUSES)[number];

export type DeliveryStoredStatus = DeliveryStatus | LegacyDeliveryStatus;

const legacyToOperationalStatus: Record<LegacyDeliveryStatus, DeliveryStatus> = {
  DRAFT: "CREADO",
  CREATED: "CREADO",
  ASSIGNED: "EN_PREPARACION",
  DISPATCHED: "DESPACHADO",
  DELIVERED: "ENTREGADO",
  NOT_DELIVERED: "NO_ENTREGADO",
  CANCELLED: "CANCELADO",
};

const operationalToLegacyStatus: Record<DeliveryStatus, LegacyDeliveryStatus> = {
  CREADO: "CREATED",
  EN_PREPARACION: "ASSIGNED",
  DESPACHADO: "DISPATCHED",
  ENTREGADO: "DELIVERED",
  NO_ENTREGADO: "NOT_DELIVERED",
  CANCELADO: "CANCELLED",
};

const validOperationalStatuses = new Set<string>(DELIVERY_STATUSES);
const validLegacyStatuses = new Set<string>(LEGACY_DELIVERY_STATUSES);

export const normalizeDeliveryStatus = (status: string): DeliveryStatus | null => {
  const normalized = status.trim().toUpperCase();
  if (validOperationalStatuses.has(normalized)) {
    return normalized as DeliveryStatus;
  }
  if (validLegacyStatuses.has(normalized)) {
    return legacyToOperationalStatus[normalized as LegacyDeliveryStatus];
  }
  return null;
};

export const toStoredDeliveryStatus = (
  status: DeliveryStatus
): LegacyDeliveryStatus => operationalToLegacyStatus[status];

export const getDeliveryStatusFilterValues = (status: string) => {
  const operationalStatus = normalizeDeliveryStatus(status);
  if (!operationalStatus) {
    return [];
  }

  return [operationalStatus, toStoredDeliveryStatus(operationalStatus)];
};

export const DELIVERY_QUERY_STATUSES = [
  ...DELIVERY_STATUSES,
  ...LEGACY_DELIVERY_STATUSES,
] as const;

export const DELIVERY_FINAL_STATUSES = [
  "ENTREGADO",
  "CANCELADO",
] as const satisfies readonly DeliveryStatus[];

export const DELIVERY_ACTIONS = [
  "PREPARE",
  "DISPATCH",
  "MARK_DELIVERED",
  "MARK_NOT_DELIVERED",
  "CANCEL",
] as const;

export type DeliveryAction = (typeof DELIVERY_ACTIONS)[number];

export const DELIVERY_PERMISSION_ACTIONS = {
  VIEW: "DELIVERIES_VIEW",
  CREATE: "DELIVERIES_CREATE",
  UPDATE: "DELIVERIES_UPDATE",
  ASSIGN: "DELIVERIES_ASSIGN",
  DISPATCH: "DELIVERIES_DISPATCH",
  MARK_DELIVERED: "DELIVERIES_MARK_DELIVERED",
  MARK_NOT_DELIVERED: "DELIVERIES_MARK_NOT_DELIVERED",
  CANCEL: "DELIVERIES_CANCEL",
  REPORTS: "DELIVERIES_REPORTS",
} as const;

export type DeliveryPermissionAction =
  (typeof DELIVERY_PERMISSION_ACTIONS)[keyof typeof DELIVERY_PERMISSION_ACTIONS];
