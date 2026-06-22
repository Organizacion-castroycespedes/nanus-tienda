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

export type DeliveryStatusValue = DeliveryStatus | LegacyDeliveryStatus;

const legacyToOperationalStatus: Record<LegacyDeliveryStatus, DeliveryStatus> = {
  DRAFT: "CREADO",
  CREATED: "CREADO",
  ASSIGNED: "EN_PREPARACION",
  DISPATCHED: "DESPACHADO",
  DELIVERED: "ENTREGADO",
  NOT_DELIVERED: "NO_ENTREGADO",
  CANCELLED: "CANCELADO",
};

export const normalizeDeliveryStatus = (
  value: string
): DeliveryStatus | null => {
  const normalized = value.trim().toUpperCase();
  if ((DELIVERY_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as DeliveryStatus;
  }
  if ((LEGACY_DELIVERY_STATUSES as readonly string[]).includes(normalized)) {
    return legacyToOperationalStatus[normalized as LegacyDeliveryStatus];
  }
  return null;
};

export type DeliveryRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string | null;
  order_id: string | null;
  sale_id: string | null;
  driver_id: string | null;
  driver: DeliveryDriverSummary | null;
  delivery_number: string;
  status: DeliveryStatus;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string;
  delivery_reference: string | null;
  delivery_fee: number;
  subtotal: number;
  total: number;
  payment_method_id: string | null;
  assigned_courier_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  dispatched_at: string | null;
  cancelled_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
};

export type DeliveryFeeSource = "INVOICE_INCLUDED" | "NO_FEE";

export type DeliveryPagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type DeliveryListResponse = {
  data: DeliveryRecord[];
  pagination: DeliveryPagination;
};

export type DeliveryDriverSummary = {
  id: string;
  name: string | null;
  phone: string | null;
  document_number: string | null;
  active: boolean | null;
};

export type DeliveryDriver = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  document_number: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GetDeliveryDriversParams = {
  query?: string;
  active?: boolean;
};

export type GetDeliveriesParams = {
  status?: DeliveryStatus | "";
  branch_id?: string;
  customer_id?: string;
  order_id?: string;
  sale_id?: string;
  driver_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
};

export type CreateDeliveryPayload = {
  branch_id?: string;
  customer_id?: string;
  order_id?: string;
  sale_id?: string;
  driver_id?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address: string;
  delivery_reference?: string;
  delivery_fee?: number;
  subtotal?: number;
  total?: number;
  delivery_fee_source?: DeliveryFeeSource;
  payment_method_id?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type AssignDeliveryPayload = {
  assigned_courier_id?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type AssignDeliveryDriverPayload = {
  driver_id: string | null;
};

export type CreateDeliveryDriverPayload = {
  name: string;
  phone?: string | null;
  document_number?: string | null;
  active?: boolean;
  notes?: string | null;
};

export type UpdateDeliveryDriverPayload = Partial<CreateDeliveryDriverPayload>;

export type DispatchDeliveryPayload = {
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type MarkDeliveryDeliveredPayload = {
  delivered_at?: string;
  received_by?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type MarkDeliveryNotDeliveredPayload = {
  reason: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type CancelDeliveryPayload = {
  reason: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

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

export type DeliveryActionKey =
  | "prepare"
  | "dispatch"
  | "mark-delivered"
  | "mark-not-delivered"
  | "cancel";

export type DeliveryActionPermissionMap = Record<DeliveryActionKey, boolean>;
