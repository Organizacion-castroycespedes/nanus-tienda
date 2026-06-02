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

const assertOptionalBoundedString = (
  value: string | null | undefined,
  field: string,
  maxLength: number
) => {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (value.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or less`);
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
  baseUnitPrice?: number | null;
  finalUnitPrice?: number | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  discountTotal?: number | null;
  appliedPromotionId?: string | null;
  appliedPromotionName?: string | null;
  taxBase?: number | null;
  taxAmount?: number | null;
  lineTotal?: number | null;
  pricingSnapshot?: Record<string, unknown> | null;
  pricingCalculatedAt?: Date | null;
  pricingSource?: string | null;
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
  readonly baseUnitPrice: number | null;
  readonly finalUnitPrice: number | null;
  readonly discountAmount: number | null;
  readonly discountPercent: number | null;
  readonly discountTotal: number | null;
  readonly appliedPromotionId: string | null;
  readonly appliedPromotionName: string | null;
  readonly taxBase: number | null;
  readonly taxAmount: number | null;
  readonly lineTotal: number | null;
  readonly pricingSnapshot: Record<string, unknown> | null;
  readonly pricingCalculatedAt: Date | null;
  readonly pricingSource: string | null;
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
    assertOptionalNonNegativeDecimal(props.baseUnitPrice, "baseUnitPrice");
    assertOptionalNonNegativeDecimal(props.finalUnitPrice, "finalUnitPrice");
    assertOptionalNonNegativeDecimal(props.discountAmount, "discountAmount");
    assertOptionalPercent(props.discountPercent, "discountPercent");
    assertOptionalNonNegativeDecimal(props.discountTotal, "discountTotal");
    assertOptionalNonNegativeDecimal(props.taxBase, "taxBase");
    assertOptionalNonNegativeDecimal(props.taxAmount, "taxAmount");
    assertOptionalNonNegativeDecimal(props.lineTotal, "lineTotal");

    if (props.subtotal !== props.price * props.quantity) {
      throw new Error("subtotal must equal price multiplied by quantity");
    }
    if (!isOptionalUuid(props.appliedPromotionId)) {
      throw new Error("appliedPromotionId must be a valid UUID");
    }
    if (!isValidOptionalDate(props.pricingCalculatedAt)) {
      throw new Error("pricingCalculatedAt must be a valid Date");
    }
    assertOptionalBoundedString(props.pricingSource, "pricingSource", 40);

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
    this.baseUnitPrice = props.baseUnitPrice ?? null;
    this.finalUnitPrice = props.finalUnitPrice ?? null;
    this.discountAmount = props.discountAmount ?? null;
    this.discountPercent = props.discountPercent ?? null;
    this.discountTotal = props.discountTotal ?? null;
    this.appliedPromotionId = props.appliedPromotionId ?? null;
    this.appliedPromotionName = props.appliedPromotionName ?? null;
    this.taxBase = props.taxBase ?? null;
    this.taxAmount = props.taxAmount ?? null;
    this.lineTotal = props.lineTotal ?? null;
    this.pricingSnapshot = props.pricingSnapshot ?? null;
    this.pricingCalculatedAt = props.pricingCalculatedAt ?? null;
    this.pricingSource = props.pricingSource ?? null;
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
