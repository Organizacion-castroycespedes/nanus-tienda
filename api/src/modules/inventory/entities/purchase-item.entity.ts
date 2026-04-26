import type { PurchaseEntity } from "./purchase.entity";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const assertPositiveDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
};

const assertNonNegativeDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
};

export type PurchaseItemProps = {
  id: string;
  purchaseId: string;
  productId: string;
  quantity: number;
  cost: number;
  subtotal: number;
  purchase?: PurchaseEntity | null;
};

export class PurchaseItemEntity {
  readonly id: string;
  readonly purchaseId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly cost: number;
  readonly subtotal: number;
  readonly purchase: PurchaseEntity | null;

  constructor(props: PurchaseItemProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.purchaseId)) {
      throw new Error("purchaseId must be a valid UUID");
    }
    if (!isUuid(props.productId)) {
      throw new Error("productId must be a valid UUID");
    }

    assertPositiveDecimal(props.quantity, "quantity");
    assertNonNegativeDecimal(props.cost, "cost");
    assertNonNegativeDecimal(props.subtotal, "subtotal");

    this.id = props.id;
    this.purchaseId = props.purchaseId;
    this.productId = props.productId;
    this.quantity = props.quantity;
    this.cost = props.cost;
    this.subtotal = props.subtotal;
    this.purchase = props.purchase ?? null;
  }

  static create(props: PurchaseItemProps) {
    return new PurchaseItemEntity(props);
  }
}

export const PURCHASE_ITEM_RELATIONS = {
  purchase: {
    type: "ManyToOne",
    target: "PurchaseEntity",
    foreignKey: "purchase_id",
  },
} as const;
