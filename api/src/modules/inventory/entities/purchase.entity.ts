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

    assertNonNegativeDecimal(props.total, "total");
    assertNonNegativeDecimal(props.balance ?? 0, "balance");

    const resolvedType = props.type ?? "CASH";
    // Keep balance derived from the purchase type for now.
    // This leaves the model ready for future payment application logic.
    const resolvedBalance = resolvedType === "CREDIT" ? props.total : 0;

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.supplierId = props.supplierId;
    this.type = resolvedType;
    this.status = props.status ?? "DRAFT";
    this.total = props.total;
    this.balance = resolvedBalance;
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
