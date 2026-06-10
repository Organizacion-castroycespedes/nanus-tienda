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

const assertOptionalNonNegativeDecimal = (
  value: number | null | undefined,
  field: string
) => {
  if (value === null || value === undefined) {
    return;
  }
  assertNonNegativeDecimal(value, field);
};

const assertOptionalPercent = (
  value: number | null | undefined,
  field: string
) => {
  if (value === null || value === undefined) {
    return;
  }
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${field} must be between 0 and 100`);
  }
};

const isOptionalUuid = (value: string | null | undefined) =>
  value === null || value === undefined || isUuid(value);

const isValidOptionalDate = (value: Date | null | undefined) =>
  value === null ||
  value === undefined ||
  (value instanceof Date && !Number.isNaN(value.getTime()));

export type OrderItemProps = {
  id: string;
  orderId: string;
  productId: string;
  orderedQuantity: number;
  deliveredQuantity?: number;
  billedQuantity?: number;
  price: number;
  subtotal: number;
  baseUnitPrice?: number | null;
  finalUnitPrice?: number | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  discountTotal?: number | null;
  appliedPromotionId?: string | null;
  appliedPromotionName?: string | null;
  taxId?: string | null;
  taxRate?: number | null;
  taxBase?: number | null;
  taxAmount?: number | null;
  lineTotal?: number | null;
  pricingSnapshot?: Record<string, unknown> | null;
  pricingCalculatedAt?: Date | null;
  order?: OrderEntity | null;
};

export class OrderItemEntity {
  readonly id: string;
  readonly orderId: string;
  readonly productId: string;
  readonly orderedQuantity: number;
  readonly deliveredQuantity: number;
  readonly billedQuantity: number;
  readonly price: number;
  readonly subtotal: number;
  readonly baseUnitPrice: number | null;
  readonly finalUnitPrice: number | null;
  readonly discountAmount: number | null;
  readonly discountPercent: number | null;
  readonly discountTotal: number | null;
  readonly appliedPromotionId: string | null;
  readonly appliedPromotionName: string | null;
  readonly taxId: string | null;
  readonly taxRate: number | null;
  readonly taxBase: number | null;
  readonly taxAmount: number | null;
  readonly lineTotal: number | null;
  readonly pricingSnapshot: Record<string, unknown> | null;
  readonly pricingCalculatedAt: Date | null;
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
    assertNonNegativeDecimal(props.billedQuantity ?? 0, "billedQuantity");
    assertNonNegativeDecimal(props.price, "price");
    assertNonNegativeDecimal(props.subtotal, "subtotal");
    assertOptionalNonNegativeDecimal(props.baseUnitPrice, "baseUnitPrice");
    assertOptionalNonNegativeDecimal(props.finalUnitPrice, "finalUnitPrice");
    assertOptionalNonNegativeDecimal(props.discountAmount, "discountAmount");
    assertOptionalPercent(props.discountPercent, "discountPercent");
    assertOptionalNonNegativeDecimal(props.discountTotal, "discountTotal");
    assertOptionalNonNegativeDecimal(props.taxRate, "taxRate");
    assertOptionalNonNegativeDecimal(props.taxBase, "taxBase");
    assertOptionalNonNegativeDecimal(props.taxAmount, "taxAmount");
    assertOptionalNonNegativeDecimal(props.lineTotal, "lineTotal");

    if ((props.deliveredQuantity ?? 0) > props.orderedQuantity) {
      throw new Error("deliveredQuantity cannot be greater than orderedQuantity");
    }
    if ((props.billedQuantity ?? 0) > (props.deliveredQuantity ?? 0)) {
      throw new Error("billedQuantity cannot be greater than deliveredQuantity");
    }
    if (!isOptionalUuid(props.appliedPromotionId)) {
      throw new Error("appliedPromotionId must be a valid UUID");
    }
    if (!isOptionalUuid(props.taxId)) {
      throw new Error("taxId must be a valid UUID");
    }
    if (!isValidOptionalDate(props.pricingCalculatedAt)) {
      throw new Error("pricingCalculatedAt must be a valid Date");
    }

    this.id = props.id;
    this.orderId = props.orderId;
    this.productId = props.productId;
    this.orderedQuantity = props.orderedQuantity;
    this.deliveredQuantity = props.deliveredQuantity ?? 0;
    this.billedQuantity = props.billedQuantity ?? 0;
    this.price = props.price;
    this.subtotal = props.subtotal;
    this.baseUnitPrice = props.baseUnitPrice ?? null;
    this.finalUnitPrice = props.finalUnitPrice ?? null;
    this.discountAmount = props.discountAmount ?? null;
    this.discountPercent = props.discountPercent ?? null;
    this.discountTotal = props.discountTotal ?? null;
    this.appliedPromotionId = props.appliedPromotionId ?? null;
    this.appliedPromotionName = props.appliedPromotionName ?? null;
    this.taxId = props.taxId ?? null;
    this.taxRate = props.taxRate ?? null;
    this.taxBase = props.taxBase ?? null;
    this.taxAmount = props.taxAmount ?? null;
    this.lineTotal = props.lineTotal ?? null;
    this.pricingSnapshot = props.pricingSnapshot ?? null;
    this.pricingCalculatedAt = props.pricingCalculatedAt ?? null;
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
