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

export const SALE_STATUSES = ["DRAFT", "CONFIRMED", "CANCELLED"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export type SaleProps = {
  id: string;
  tenantId: string;
  customerId: string;
  orderId?: string | null;
  type?: SaleType;
  status?: SaleStatus;
  total: number;
  balance?: number;
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

    assertNonNegativeDecimal(props.total, "total");
    assertNonNegativeDecimal(props.balance ?? 0, "balance");

    const resolvedType = props.type ?? "CASH";
    const resolvedBalance = resolvedType === "CREDIT"
      ? props.balance ?? props.total
      : 0;

    if (resolvedType === "CASH" && resolvedBalance !== 0) {
      throw new Error("balance must be 0 for cash sales");
    }

    if (resolvedType === "CREDIT" && resolvedBalance > props.total) {
      throw new Error("balance cannot be greater than total for credit sales");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.customerId = props.customerId;
    this.orderId = props.orderId ?? null;
    this.type = resolvedType;
    this.status = props.status ?? "DRAFT";
    this.total = props.total;
    this.balance = resolvedBalance;
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
