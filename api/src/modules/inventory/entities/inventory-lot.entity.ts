const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const assertOptionalUuid = (
  value: string | null | undefined,
  field: string
) => {
  if (value !== undefined && value !== null && !isUuid(value)) {
    throw new Error(`${field} must be a valid UUID`);
  }
};

const assertNonNegativeDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
};

export const INVENTORY_LOT_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "BLOCKED",
  "CONSUMED",
  "CANCELLED",
] as const;

export type InventoryLotStatus = (typeof INVENTORY_LOT_STATUSES)[number];

export type InventoryLotProps = {
  id: string;
  tenantId: string;
  branchId: string;
  productId: string;
  supplierId?: string | null;
  purchaseId?: string | null;
  purchaseItemId?: string | null;
  lotCode: string;
  expirationDate?: Date | null;
  receivedAt: Date;
  unitCost?: number;
  status?: InventoryLotStatus;
  isLegacy?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class InventoryLotEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly productId: string;
  readonly supplierId: string | null;
  readonly purchaseId: string | null;
  readonly purchaseItemId: string | null;
  readonly lotCode: string;
  readonly expirationDate: Date | null;
  readonly receivedAt: Date;
  readonly unitCost: number;
  readonly status: InventoryLotStatus;
  readonly isLegacy: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: InventoryLotProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.branchId)) {
      throw new Error("branchId must be a valid UUID");
    }
    if (!isUuid(props.productId)) {
      throw new Error("productId must be a valid UUID");
    }
    assertOptionalUuid(props.supplierId, "supplierId");
    assertOptionalUuid(props.purchaseId, "purchaseId");
    assertOptionalUuid(props.purchaseItemId, "purchaseItemId");
    if (!props.lotCode?.trim()) {
      throw new Error("lotCode is required");
    }
    if (Number.isNaN(props.receivedAt.getTime())) {
      throw new Error("receivedAt must be a valid date");
    }
    if (
      props.expirationDate !== undefined &&
      props.expirationDate !== null &&
      Number.isNaN(props.expirationDate.getTime())
    ) {
      throw new Error("expirationDate must be a valid date");
    }
    if (
      props.status !== undefined &&
      !INVENTORY_LOT_STATUSES.includes(props.status)
    ) {
      throw new Error("status is invalid");
    }

    assertNonNegativeDecimal(props.unitCost ?? 0, "unitCost");

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.productId = props.productId;
    this.supplierId = props.supplierId ?? null;
    this.purchaseId = props.purchaseId ?? null;
    this.purchaseItemId = props.purchaseItemId ?? null;
    this.lotCode = props.lotCode.trim().toUpperCase();
    this.expirationDate = props.expirationDate ?? null;
    this.receivedAt = props.receivedAt;
    this.unitCost = props.unitCost ?? 0;
    this.status = props.status ?? "ACTIVE";
    this.isLegacy = props.isLegacy ?? false;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: InventoryLotProps) {
    return new InventoryLotEntity(props);
  }
}
