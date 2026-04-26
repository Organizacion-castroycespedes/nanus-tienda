import type { OrderEntity } from "./order.entity";

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

export type OrderItemProps = {
  id: string;
  orderId: string;
  productId: string;
  orderedQuantity: number;
  deliveredQuantity?: number;
  price: number;
  subtotal: number;
  order?: OrderEntity | null;
};

export class OrderItemEntity {
  readonly id: string;
  readonly orderId: string;
  readonly productId: string;
  readonly orderedQuantity: number;
  readonly deliveredQuantity: number;
  readonly price: number;
  readonly subtotal: number;
  readonly order: OrderEntity | null;

  constructor(props: OrderItemProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.orderId)) {
      throw new Error("orderId must be a valid UUID");
    }
    if (!isUuid(props.productId)) {
      throw new Error("productId must be a valid UUID");
    }

    assertPositiveDecimal(props.orderedQuantity, "orderedQuantity");
    assertNonNegativeDecimal(props.deliveredQuantity ?? 0, "deliveredQuantity");
    assertNonNegativeDecimal(props.price, "price");
    assertNonNegativeDecimal(props.subtotal, "subtotal");

    if ((props.deliveredQuantity ?? 0) > props.orderedQuantity) {
      throw new Error("deliveredQuantity cannot be greater than orderedQuantity");
    }

    this.id = props.id;
    this.orderId = props.orderId;
    this.productId = props.productId;
    this.orderedQuantity = props.orderedQuantity;
    this.deliveredQuantity = props.deliveredQuantity ?? 0;
    this.price = props.price;
    this.subtotal = props.subtotal;
    this.order = props.order ?? null;
  }

  static create(props: OrderItemProps) {
    return new OrderItemEntity(props);
  }

  get quantity() {
    return this.orderedQuantity;
  }
}

export const ORDER_ITEM_RELATIONS = {
  order: {
    type: "ManyToOne",
    target: "OrderEntity",
    foreignKey: "order_id",
  },
} as const;
