const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const assertNonNegativeDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
};

export const PURCHASE_STATUSES = [
  "DRAFT",
  "PENDING",
  "PARTIAL",
  "RECEIVED",
  "CANCELLED",
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const PURCHASE_PAYMENT_STATUSES = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERPAID",
] as const;

export type PurchasePaymentStatus = (typeof PURCHASE_PAYMENT_STATUSES)[number];

export const PURCHASE_TYPES = ["CASH", "CREDIT"] as const;

export type PurchaseType = (typeof PURCHASE_TYPES)[number];

export type PurchaseProps = {
  id: string;
  tenantId: string;
  supplierId: string;
  type?: PurchaseType;
  status?: PurchaseStatus;
  total: number;
  balance?: number;
  paymentStatus?: PurchasePaymentStatus;
  totalPaid?: number;
  balanceDue?: number;
  createdAt: Date;
};

export class PurchaseEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly supplierId: string;
  readonly type: PurchaseType;
  readonly status: PurchaseStatus;
  readonly total: number;
  readonly balance: number;
  readonly paymentStatus: PurchasePaymentStatus;
  readonly totalPaid: number;
  readonly balanceDue: number;
  readonly createdAt: Date;

  constructor(props: PurchaseProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.supplierId)) {
      throw new Error("supplierId must be a valid UUID");
    }
    if (
      props.type !== undefined &&
      !PURCHASE_TYPES.includes(props.type)
    ) {
      throw new Error("type is invalid");
    }
    if (
      props.status !== undefined &&
      !PURCHASE_STATUSES.includes(props.status)
    ) {
      throw new Error("status is invalid");
    }
    if (
      props.paymentStatus !== undefined &&
      !PURCHASE_PAYMENT_STATUSES.includes(props.paymentStatus)
    ) {
      throw new Error("paymentStatus is invalid");
    }

    assertNonNegativeDecimal(props.total, "total");
    assertNonNegativeDecimal(props.balance ?? 0, "balance");
    assertNonNegativeDecimal(props.totalPaid ?? 0, "totalPaid");
    assertNonNegativeDecimal(props.balanceDue ?? props.balance ?? props.total, "balanceDue");

    const resolvedType = props.type ?? "CASH";
    const resolvedBalanceDue = props.balanceDue ?? props.balance ?? props.total;
    const resolvedTotalPaid = props.totalPaid ?? Math.max(props.total - resolvedBalanceDue, 0);
    const resolvedBalance = props.balance ?? resolvedBalanceDue;

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.supplierId = props.supplierId;
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

  static create(props: PurchaseProps) {
    return new PurchaseEntity(props);
  }

  affectsInventory() {
    // Draft, pending and cancelled purchases should not move stock.
    return this.status === "RECEIVED";
  }
}
