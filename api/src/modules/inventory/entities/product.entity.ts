import type { TaxEntity } from "./tax.entity";
import type { UnitEntity } from "./unit.entity";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const assertNonNegativeDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
};

export type ProductProps = {
  id: string;
  tenantId: string;
  unitId: string;
  taxId?: string | null;
  unit?: UnitEntity | null;
  tax?: TaxEntity | null;
  name: string;
  description?: string | null;
  sku: string;
  price: number;
  cost: number;
  priceWithTax: number;
  priceWithoutTax: number;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class ProductEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly unitId: string;
  readonly taxId: string | null;
  readonly unit: UnitEntity | null;
  readonly tax: TaxEntity | null;
  readonly name: string;
  readonly description: string | null;
  readonly sku: string;
  readonly price: number;
  readonly cost: number;
  readonly priceWithTax: number;
  readonly priceWithoutTax: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ProductProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.unitId)) {
      throw new Error("unitId must be a valid UUID");
    }
    if (props.taxId !== undefined && props.taxId !== null && !isUuid(props.taxId)) {
      throw new Error("taxId must be a valid UUID");
    }
    if (!props.name?.trim()) {
      throw new Error("name is required");
    }
    if (!props.sku?.trim()) {
      throw new Error("sku is required");
    }

    assertNonNegativeDecimal(props.price, "price");
    assertNonNegativeDecimal(props.cost, "cost");
    assertNonNegativeDecimal(props.priceWithTax, "priceWithTax");
    assertNonNegativeDecimal(props.priceWithoutTax, "priceWithoutTax");

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.unitId = props.unitId;
    this.taxId = props.taxId ?? null;
    this.unit = props.unit ?? null;
    this.tax = props.tax ?? null;
    this.name = props.name.trim();
    this.description = props.description?.trim() || null;
    this.sku = props.sku.trim().toUpperCase();
    this.price = props.price;
    this.cost = props.cost;
    this.priceWithTax = props.priceWithTax;
    this.priceWithoutTax = props.priceWithoutTax;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: ProductProps) {
    return new ProductEntity(props);
  }
}

export const PRODUCT_UNIQUE_INDEX = ["tenant_id", "sku"] as const;
export const PRODUCT_RELATIONS = {
  unit: {
    type: "ManyToOne",
    target: "UnitEntity",
    foreignKey: "unit_id",
  },
  tax: {
    type: "ManyToOne",
    target: "TaxEntity",
    foreignKey: "tax_id",
    nullable: true,
  },
} as const;
