const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const assertPositiveDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
};

export const STOCK_MOVEMENT_TYPES = ["IN", "OUT"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_REFERENCE_TYPES = [
  "PURCHASE",
  "SALE",
  "ADJUSTMENT",
] as const;
export type StockReferenceType = (typeof STOCK_REFERENCE_TYPES)[number];

export type StockMovementProps = {
  id: string;
  tenantId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  referenceType: StockReferenceType;
  referenceId: string;
  createdAt: Date;
};

export class StockMovementEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly type: StockMovementType;
  readonly quantity: number;
  readonly referenceType: StockReferenceType;
  readonly referenceId: string;
  readonly createdAt: Date;

  constructor(props: StockMovementProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.productId)) {
      throw new Error("productId must be a valid UUID");
    }
    if (!isUuid(props.referenceId)) {
      throw new Error("referenceId must be a valid UUID");
    }
    if (!STOCK_MOVEMENT_TYPES.includes(props.type)) {
      throw new Error("type must be IN or OUT");
    }
    if (!STOCK_REFERENCE_TYPES.includes(props.referenceType)) {
      throw new Error("referenceType is invalid");
    }

    assertPositiveDecimal(props.quantity, "quantity");

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.productId = props.productId;
    this.type = props.type;
    this.quantity = props.quantity;
    this.referenceType = props.referenceType;
    this.referenceId = props.referenceId;
    this.createdAt = props.createdAt;
  }

  static create(props: StockMovementProps) {
    return new StockMovementEntity(props);
  }

  getSignedQuantity() {
    return this.type === "IN" ? this.quantity : -this.quantity;
  }
}
