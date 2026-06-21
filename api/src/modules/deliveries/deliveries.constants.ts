export const DELIVERY_STATUSES = [
  "DRAFT",
  "CREATED",
  "ASSIGNED",
  "DISPATCHED",
  "DELIVERED",
  "NOT_DELIVERED",
  "CANCELLED",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_FINAL_STATUSES = [
  "DELIVERED",
  "NOT_DELIVERED",
  "CANCELLED",
] as const satisfies readonly DeliveryStatus[];

export const DELIVERY_ACTIONS = [
  "ASSIGN",
  "DISPATCH",
  "MARK_DELIVERED",
  "MARK_NOT_DELIVERED",
  "CANCEL",
] as const;

export type DeliveryAction = (typeof DELIVERY_ACTIONS)[number];
