import type { SaleEntity } from "./sale.entity";

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

export type SaleItemProps = {
  id: string;
  tenantId: string;
  saleId: string;
  productId: string;
  orderItemId?: string | null;
  quantity: number;
  price: number;
  priceWithoutTax: number;
  taxTotal?: number;
  subtotal: number;
  createdAt: Date;
  sale?: SaleEntity | null;
};

export class SaleItemEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly saleId: string;
  readonly productId: string;
  readonly orderItemId: string | null;
  readonly quantity: number;
  readonly price: number;
  readonly priceWithoutTax: number;
  readonly taxTotal: number;
  readonly subtotal: number;
  readonly createdAt: Date;
  readonly sale: SaleEntity | null;

  constructor(props: SaleItemProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.saleId)) {
      throw new Error("saleId must be a valid UUID");
    }
    if (!isUuid(props.productId)) {
      throw new Error("productId must be a valid UUID");
    }
    if (
      props.orderItemId !== undefined &&
      props.orderItemId !== null &&
      !isUuid(props.orderItemId)
    ) {
      throw new Error("orderItemId must be a valid UUID");
    }

    assertPositiveDecimal(props.quantity, "quantity");
    assertNonNegativeDecimal(props.price, "price");
    assertNonNegativeDecimal(props.priceWithoutTax, "priceWithoutTax");
    assertNonNegativeDecimal(props.taxTotal ?? 0, "taxTotal");
    assertNonNegativeDecimal(props.subtotal, "subtotal");

    if (props.subtotal !== props.price * props.quantity) {
      throw new Error("subtotal must equal price multiplied by quantity");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.saleId = props.saleId;
    this.productId = props.productId;
    this.orderItemId = props.orderItemId ?? null;
    this.quantity = props.quantity;
    this.price = props.price;
    this.priceWithoutTax = props.priceWithoutTax;
    this.taxTotal = props.taxTotal ?? 0;
    this.subtotal = props.subtotal;
    this.createdAt = props.createdAt;
    this.sale = props.sale ?? null;
  }

  static create(props: SaleItemProps) {
    return new SaleItemEntity(props);
  }
}

export const SALE_ITEM_RELATIONS = {
  sale: {
    type: "ManyToOne",
    target: "SaleEntity",
    foreignKey: "sale_id",
  },
} as const;
