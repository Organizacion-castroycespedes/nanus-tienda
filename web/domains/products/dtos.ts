export type ProductOperationalStatus = "ACTIVE" | "INACTIVE" | "BLOCKED" | "DISCONTINUED";

export type ProductRotationClass = "HIGH" | "MEDIUM" | "LOW" | "NO_MOVEMENT";

export type ProductSaleType = "UNIT" | "WEIGHT" | "BOTH";

export type ProductMeasurementUnit =
  | "UND"
  | "M"
  | "L"
  | "CM"
  | "M2"
  | "KG"
  | "LB"
  | "G"
  | "OZ";

/** Unidades de venta por unidad (V118). Las demas son de peso. */
export const UNIT_MEASUREMENT_UNITS: readonly ProductMeasurementUnit[] = ["UND", "M", "L", "CM", "M2"];

export const isUnitMeasurementUnit = (value: unknown): value is ProductMeasurementUnit =>
  (UNIT_MEASUREMENT_UNITS as readonly unknown[]).includes(value);

export type ProductImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export type ProductBarcodeType =
  | "UNIT"
  | "PACKAGE"
  | "BOX"
  | "SUPPLIER"
  | "INTERNAL"
  | "OTHER";

export type ProductBarcode = {
  id: string;
  productId: string;
  barcode: string;
  barcodeType: ProductBarcodeType;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductBarcodeSummary = {
  code: string;
  barcode: string;
  barcodeType: ProductBarcodeType;
  isPrimary: boolean;
  isActive: boolean;
};

export type ProductUnitSummary = {
  id?: string;
  code?: string | null;
  name?: string | null;
  symbol?: string | null;
  abbreviation?: string | null;
};

export type ProductResponse = {
  id: string;
  tenantId: string;
  tenantName?: string;
  unitId: string;
  unit?: ProductUnitSummary | string | null;
  taxId: string | null;
  taxes?: Array<{
    id?: string;
    taxId: string;
    calculationOrder: number;
    isActive?: boolean;
    taxName?: string | null;
    taxRate?: number | null;
    isIncluded?: boolean | null;
    calculationMethodCode?: string | null;
    taxTypeCode?: string | null;
    taxTypeDianCode?: string | null;
  }>;
  taxProfile?: {
    taxProductCategoryId: string;
    taxProductCategoryCode?: string | null;
    isAlcoholicBeverage?: boolean;
    alcoholDegree?: number | null;
    netVolumeMl?: number | null;
    daneCertifiedRetailPrice?: number | null;
    danePriceEffectiveFrom?: string | null;
    danePriceEffectiveTo?: string | null;
  } | null;
  name: string;
  description: string | null;
  sku: string;
  standardIdentification?: {
    scheme: "001" | "010" | "020" | "999";
    code: string;
  } | null;
  price: number;
  cost: number;
  priceWithTax: number;
  priceWithoutTax: number;
  isActive: boolean;
  isInventoryable?: boolean;
  isPerishable?: boolean;
  requiresLot?: boolean;
  requiresExpiration?: boolean;
  requiresSerial?: boolean;
  /** V118: permite cantidades con hasta 2 decimales en compras, recepcion y venta por unidad. */
  allowsDecimalQuantity?: boolean;
  operationalStatus?: ProductOperationalStatus;
  rotationClass?: ProductRotationClass | null;
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
  imageUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  branchId?: string;
  branchName?: string | null;
  terminalName?: string | null;
  stock?: number;
  isWeighable?: boolean;
  weighable?: boolean;
  soldByWeight?: boolean;
  unidad?: ProductUnitSummary | string | null;
  unitCode?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
  unitAbbreviation?: string | null;
  productType?: string | null;
  primaryBarcode?: string | null;
  barcodeCodes?: string[];
  barcodes?: ProductBarcodeSummary[];
};

export type ProductPriceHistoryStatus =
  | "APPLIED"
  | "PENDING_APPROVAL"
  | "REJECTED";

export type ProductPriceHistoryEntry = {
  id: string;
  tenantId: string;
  productId: string;
  previousPrice: number;
  newPrice: number;
  reason: string;
  changedBy: string | null;
  validFrom: string;
  validTo: string | null;
  status: ProductPriceHistoryStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type ProductPriceChangeResponse = {
  productId: string;
  previousPrice: number;
  newPrice: number;
  reason: string;
  changedBy: string | null;
  appliedAt: string;
};
