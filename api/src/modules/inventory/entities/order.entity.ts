const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const assertNonNegativeDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
};

export const ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PARTIAL",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TYPES = ["CASH", "CREDIT"] as const;

export type OrderType = (typeof ORDER_TYPES)[number];

export type OrderProps = {
  id: string;
  tenantId: string;
  customerId: string;
  type?: OrderType;
  status?: OrderStatus;
  total: number;
  createdAt: Date;
};

export class OrderEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly customerId: string;
  readonly type: OrderType;
  readonly status: OrderStatus;
  readonly total: number;
  readonly createdAt: Date;

  constructor(props: OrderProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.customerId)) {
      throw new Error("customerId must be a valid UUID");
    }
    if (props.type !== undefined && !ORDER_TYPES.includes(props.type)) {
      throw new Error("type is invalid");
    }
    if (props.status !== undefined && !ORDER_STATUSES.includes(props.status)) {
      throw new Error("status is invalid");
    }

    assertNonNegativeDecimal(props.total, "total");

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.customerId = props.customerId;
    this.type = props.type ?? "CASH";
    this.status = props.status ?? "DRAFT";
    this.total = props.total;
    this.createdAt = props.createdAt;
  }

  static create(props: OrderProps) {
    return new OrderEntity(props);
  }

  affectsInventory() {
    return false;
  }

  supportsPartialDeliveries() {
    return true;
  }
}
