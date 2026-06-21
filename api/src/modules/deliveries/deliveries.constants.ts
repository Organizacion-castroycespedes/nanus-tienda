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
