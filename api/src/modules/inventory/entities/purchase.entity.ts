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
  "PENDING",
  "RECEIVED",
  "CANCELLED",
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export type PurchaseProps = {
  id: string;
  tenantId: string;
  supplierId: string;
  status?: PurchaseStatus;
  total: number;
  createdAt: Date;
};

export class PurchaseEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly supplierId: string;
  readonly status: PurchaseStatus;
  readonly total: number;
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
      props.status !== undefined &&
      !PURCHASE_STATUSES.includes(props.status)
    ) {
      throw new Error("status is invalid");
    }

    assertNonNegativeDecimal(props.total, "total");

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.supplierId = props.supplierId;
    this.status = props.status ?? "PENDING";
    this.total = props.total;
    this.createdAt = props.createdAt;
  }

  static create(props: PurchaseProps) {
    return new PurchaseEntity(props);
  }

  affectsInventory() {
    return this.status === "RECEIVED";
  }
}
