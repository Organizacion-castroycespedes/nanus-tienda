const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const assertNonNegativeDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
};

export const SALE_TYPES = ["CASH", "CREDIT"] as const;
export type SaleType = (typeof SALE_TYPES)[number];

export const SALE_STATUSES = ["DRAFT", "CONFIRMED", "CANCELLED", "REFUNDED"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const SALE_PAYMENT_STATUSES = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERPAID",
] as const;
export type SalePaymentStatus = (typeof SALE_PAYMENT_STATUSES)[number];

export type SaleProps = {
  id: string;
  tenantId: string;
  customerId: string;
  orderId?: string | null;
  type?: SaleType;
  status?: SaleStatus;
  total: number;
  balance?: number;
  paymentStatus?: SalePaymentStatus;
  totalPaid?: number;
  balanceDue?: number;
  createdAt: Date;
};

export class SaleEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly customerId: string;
  readonly orderId: string | null;
  readonly type: SaleType;
  readonly status: SaleStatus;
  readonly total: number;
  readonly balance: number;
  readonly paymentStatus: SalePaymentStatus;
  readonly totalPaid: number;
  readonly balanceDue: number;
  readonly createdAt: Date;

  constructor(props: SaleProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.customerId)) {
      throw new Error("customerId must be a valid UUID");
    }
    if (props.orderId !== undefined && props.orderId !== null && !isUuid(props.orderId)) {
      throw new Error("orderId must be a valid UUID");
    }
    if (props.type !== undefined && !SALE_TYPES.includes(props.type)) {
      throw new Error("type is invalid");
    }
    if (props.status !== undefined && !SALE_STATUSES.includes(props.status)) {
      throw new Error("status is invalid");
    }
    if (
      props.paymentStatus !== undefined &&
      !SALE_PAYMENT_STATUSES.includes(props.paymentStatus)
    ) {
      throw new Error("paymentStatus is invalid");
    }

    assertNonNegativeDecimal(props.total, "total");
    assertNonNegativeDecimal(props.balance ?? 0, "balance");
    assertNonNegativeDecimal(props.totalPaid ?? 0, "totalPaid");
    assertNonNegativeDecimal(props.balanceDue ?? props.balance ?? 0, "balanceDue");

    const resolvedType = props.type ?? "CASH";
    const resolvedBalanceDue = props.balanceDue ?? props.balance ?? props.total;
    const resolvedTotalPaid = props.totalPaid ?? Math.max(props.total - resolvedBalanceDue, 0);
    const resolvedBalance = props.balance ?? resolvedBalanceDue;

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.customerId = props.customerId;
    this.orderId = props.orderId ?? null;
    this.type = resolvedType;
    this.status = props.status ?? "DRAFT";
    this.total = props.total;
    this.balance = resolvedBalance;
    this.totalPaid = resolvedTotalPaid;
    this.balanceDue = resolvedBalanceDue;
    this.paymentStatus =
      props.paymentStatus ??
      (resolvedTotalPaid <= 0
        ? "PENDING"
        : resolvedTotalPaid < props.total
          ? "PARTIAL"
          : resolvedTotalPaid === props.total
            ? "PAID"
            : "OVERPAID");
    this.createdAt = props.createdAt;
  }

  static create(props: SaleProps) {
    return new SaleEntity(props);
  }
}

export const SALE_RELATIONS = {
  customer: {
    type: "ManyToOne",
    target: "CustomerEntity",
    foreignKey: "customer_id",
  },
  order: {
    type: "ManyToOne",
    target: "OrderEntity",
    foreignKey: "order_id",
  },
} as const;
