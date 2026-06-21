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

export type DeliveryRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string | null;
  order_id: string | null;
  sale_id: string | null;
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
  cancelled_at: string | null;
  delivered_at: string | null;
};

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

export type GetDeliveriesParams = {
  status?: DeliveryStatus | "";
  branch_id?: string;
  customer_id?: string;
  order_id?: string;
  sale_id?: string;
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
  customer_name?: string;
  customer_phone?: string;
  delivery_address: string;
  delivery_reference?: string;
  delivery_fee?: number;
  subtotal?: number;
  total?: number;
  payment_method_id?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type AssignDeliveryPayload = {
  assigned_courier_id: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

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
  | "assign"
  | "dispatch"
  | "mark-delivered"
  | "mark-not-delivered"
  | "cancel";

export type DeliveryActionPermissionMap = Record<DeliveryActionKey, boolean>;
