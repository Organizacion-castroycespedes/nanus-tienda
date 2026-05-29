export type ProductOperationalStatus = "ACTIVE" | "INACTIVE" | "BLOCKED" | "DISCONTINUED";

export type ProductRotationClass = "HIGH" | "MEDIUM" | "LOW" | "NO_MOVEMENT";

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

export type ProductResponse = {
  id: string;
  tenantId: string;
  tenantName?: string;
  unitId: string;
  taxId: string | null;
  name: string;
  description: string | null;
  sku: string;
  price: number;
  cost: number;
  priceWithTax: number;
  priceWithoutTax: number;
  isActive: boolean;
  isPerishable?: boolean;
  requiresLot?: boolean;
  requiresExpiration?: boolean;
  operationalStatus?: ProductOperationalStatus;
  rotationClass?: ProductRotationClass | null;
  minStock?: number | null;
  maxStock?: number | null;
  createdAt: string;
  updatedAt: string;
  branchId?: string;
  branchName?: string | null;
  terminalName?: string | null;
  stock?: number;
};
