import type { TaxEntity } from "./tax.entity";
import type { UnitEntity } from "./unit.entity";
import {
  PRODUCT_IMAGE_MIME_TYPES,
  type ProductImageMimeType,
} from "./product-category.entity";

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

export const PRODUCT_STANDARD_IDENTIFICATION_SCHEMES = [
  "001",
  "010",
  "020",
  "999",
] as const;

export type ProductStandardIdentificationScheme =
  (typeof PRODUCT_STANDARD_IDENTIFICATION_SCHEMES)[number];

export type ProductStandardIdentification = {
  scheme: ProductStandardIdentificationScheme;
  code: string;
};

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
  standardIdentification?: ProductStandardIdentification | null;
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
  categoryId?: string | null;
  subcategoryId?: string | null;
  imageUrl?: string | null;
  imageStorageKey?: string | null;
  imageAltText?: string | null;
  imageMimeType?: ProductImageMimeType | null;
  imageSizeBytes?: number | null;
  imageUpdatedAt?: Date | null;
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
  readonly standardIdentification: ProductStandardIdentification | null;
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
  readonly categoryId: string | null;
  readonly subcategoryId: string | null;
  readonly imageUrl: string | null;
  readonly imageStorageKey: string | null;
  readonly imageAltText: string | null;
  readonly imageMimeType: ProductImageMimeType | null;
  readonly imageSizeBytes: number | null;
  readonly imageUpdatedAt: Date | null;
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
    if (
      props.categoryId !== undefined &&
      props.categoryId !== null &&
      !isUuid(props.categoryId)
    ) {
      throw new Error("categoryId must be a valid UUID");
    }
    if (
      props.subcategoryId !== undefined &&
      props.subcategoryId !== null &&
      !isUuid(props.subcategoryId)
    ) {
      throw new Error("subcategoryId must be a valid UUID");
    }
    if (!props.name?.trim()) {
      throw new Error("name is required");
    }
    if (!props.sku?.trim()) {
      throw new Error("sku is required");
    }
    if (props.standardIdentification !== undefined && props.standardIdentification !== null) {
      if (!PRODUCT_STANDARD_IDENTIFICATION_SCHEMES.includes(props.standardIdentification.scheme)) {
        throw new Error("standardIdentification scheme is invalid");
      }
      if (!props.standardIdentification.code?.trim() || isUuid(props.standardIdentification.code.trim())) {
        throw new Error("standardIdentification code must be a real non-UUID value");
      }
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
    if (props.imageSizeBytes !== undefined && props.imageSizeBytes !== null) {
      assertNonNegativeDecimal(props.imageSizeBytes, "imageSizeBytes");
    }
    if (
      props.imageMimeType !== undefined &&
      props.imageMimeType !== null &&
      !PRODUCT_IMAGE_MIME_TYPES.includes(props.imageMimeType)
    ) {
      throw new Error("imageMimeType is invalid");
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
      props.subcategoryId !== undefined &&
      props.subcategoryId !== null &&
      (props.categoryId === undefined || props.categoryId === null)
    ) {
      throw new Error("categoryId is required when subcategoryId is provided");
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
    this.standardIdentification = props.standardIdentification
      ? {
          scheme: props.standardIdentification.scheme,
          code: props.standardIdentification.code.trim(),
        }
      : null;
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
    this.categoryId = props.categoryId ?? null;
    this.subcategoryId = props.subcategoryId ?? null;
    this.imageUrl = props.imageUrl?.trim() || null;
    this.imageStorageKey = props.imageStorageKey?.trim() || null;
    this.imageAltText = props.imageAltText?.trim() || null;
    this.imageMimeType = props.imageMimeType ?? null;
    this.imageSizeBytes = props.imageSizeBytes ?? null;
    this.imageUpdatedAt = props.imageUpdatedAt ?? null;
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
