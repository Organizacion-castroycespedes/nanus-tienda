const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

export const PRODUCT_BARCODE_TYPES = [
  "UNIT",
  "PACKAGE",
  "BOX",
  "SUPPLIER",
  "INTERNAL",
  "OTHER",
] as const;

export type ProductBarcodeType = (typeof PRODUCT_BARCODE_TYPES)[number];

export type ProductBarcodeProps = {
  id: string;
  tenantId: string;
  productId: string;
  barcode: string;
  barcodeType?: ProductBarcodeType;
  isPrimary?: boolean;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class ProductBarcodeEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly barcode: string;
  readonly barcodeType: ProductBarcodeType;
  readonly isPrimary: boolean;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ProductBarcodeProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.productId)) {
      throw new Error("productId must be a valid UUID");
    }
    if (!props.barcode?.trim()) {
      throw new Error("barcode is required");
    }
    if (
      props.barcodeType !== undefined &&
      !PRODUCT_BARCODE_TYPES.includes(props.barcodeType)
    ) {
      throw new Error("barcodeType is invalid");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.productId = props.productId;
    this.barcode = props.barcode.trim();
    this.barcodeType = props.barcodeType ?? "UNIT";
    this.isPrimary = props.isPrimary ?? false;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: ProductBarcodeProps) {
    return new ProductBarcodeEntity(props);
  }
}
