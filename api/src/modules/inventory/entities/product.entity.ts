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

export const PRODUCT_OPERATIONAL_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "BLOCKED",
  "DISCONTINUED",
] as const;

export const PRODUCT_ROTATION_CLASSES = [
  "HIGH",
  "MEDIUM",
  "LOW",
  "NO_MOVEMENT",
] as const;

export const PRODUCT_SALE_TYPES = ["UNIT", "WEIGHT", "BOTH"] as const;

export const PRODUCT_MEASUREMENT_UNITS = [
  "UND",
  "KG",
  "LB",
  "G",
  "OZ",
] as const;

export type ProductOperationalStatus =
  (typeof PRODUCT_OPERATIONAL_STATUSES)[number];

export type ProductRotationClass =
  (typeof PRODUCT_ROTATION_CLASSES)[number] | null;

export type ProductSaleType = (typeof PRODUCT_SALE_TYPES)[number];

export type ProductMeasurementUnit =
  (typeof PRODUCT_MEASUREMENT_UNITS)[number];

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
  isPerishable?: boolean;
  requiresLot?: boolean;
  requiresExpiration?: boolean;
  operationalStatus?: ProductOperationalStatus;
  rotationClass?: ProductRotationClass;
  saleType?: ProductSaleType;
  measurementUnit?: ProductMeasurementUnit;
  minStock?: number | null;
  maxStock?: number | null;
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
  readonly isPerishable: boolean;
  readonly requiresLot: boolean;
  readonly requiresExpiration: boolean;
  readonly operationalStatus: ProductOperationalStatus;
  readonly rotationClass: ProductRotationClass;
  readonly saleType: ProductSaleType;
  readonly measurementUnit: ProductMeasurementUnit;
  readonly minStock: number | null;
  readonly maxStock: number | null;
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
    if (props.minStock !== undefined && props.minStock !== null) {
      assertNonNegativeDecimal(props.minStock, "minStock");
    }
    if (props.maxStock !== undefined && props.maxStock !== null) {
      assertNonNegativeDecimal(props.maxStock, "maxStock");
    }
    if (
      props.operationalStatus !== undefined &&
      !PRODUCT_OPERATIONAL_STATUSES.includes(props.operationalStatus)
    ) {
      throw new Error("operationalStatus is invalid");
    }
    if (
      props.rotationClass !== undefined &&
      props.rotationClass !== null &&
      !PRODUCT_ROTATION_CLASSES.includes(props.rotationClass)
    ) {
      throw new Error("rotationClass is invalid");
    }
    if (
      props.saleType !== undefined &&
      !PRODUCT_SALE_TYPES.includes(props.saleType)
    ) {
      throw new Error("saleType is invalid");
    }
    if (
      props.measurementUnit !== undefined &&
      !PRODUCT_MEASUREMENT_UNITS.includes(props.measurementUnit)
    ) {
      throw new Error("measurementUnit is invalid");
    }
    const saleType = props.saleType ?? "UNIT";
    const measurementUnit = props.measurementUnit ?? "UND";
    if (saleType === "UNIT" && measurementUnit !== "UND") {
      throw new Error("UNIT products must use UND measurementUnit");
    }
    if (saleType !== "UNIT" && measurementUnit === "UND") {
      throw new Error("weighted products must use a weight measurementUnit");
    }
    if (
      props.minStock !== undefined &&
      props.minStock !== null &&
      props.maxStock !== undefined &&
      props.maxStock !== null &&
      props.maxStock < props.minStock
    ) {
      throw new Error("maxStock must be greater than or equal to minStock");
    }
    if (props.requiresExpiration === true && props.requiresLot !== true) {
      throw new Error("requiresLot is required when requiresExpiration is true");
    }
    if (
      props.isPerishable === true &&
      props.requiresLot !== true &&
      props.requiresExpiration !== true
    ) {
      throw new Error(
        "isPerishable requires requiresLot or requiresExpiration"
      );
    }

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
    this.isPerishable = props.isPerishable ?? false;
    this.requiresLot = props.requiresLot ?? false;
    this.requiresExpiration = props.requiresExpiration ?? false;
    this.operationalStatus = props.operationalStatus ?? "ACTIVE";
    this.rotationClass = props.rotationClass ?? null;
    this.saleType = saleType;
    this.measurementUnit = measurementUnit;
    this.minStock = props.minStock ?? null;
    this.maxStock = props.maxStock ?? null;
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
