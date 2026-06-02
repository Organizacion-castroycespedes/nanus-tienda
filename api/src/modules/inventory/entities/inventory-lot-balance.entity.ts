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

export type InventoryLotBalanceProps = {
  id: string;
  tenantId: string;
  branchId: string;
  productId: string;
  lotId: string;
  locationId?: string | null;
  quantityOnHand?: number;
  quantityReserved?: number;
  quantityAvailable?: number;
  lastMovementAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class InventoryLotBalanceEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly productId: string;
  readonly lotId: string;
  readonly locationId: string | null;
  readonly quantityOnHand: number;
  readonly quantityReserved: number;
  readonly quantityAvailable: number;
  readonly lastMovementAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: InventoryLotBalanceProps) {
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
    if (!isUuid(props.lotId)) {
      throw new Error("lotId must be a valid UUID");
    }
    assertOptionalUuid(props.locationId, "locationId");

    const quantityOnHand = props.quantityOnHand ?? 0;
    const quantityReserved = props.quantityReserved ?? 0;
    const quantityAvailable =
      props.quantityAvailable ?? quantityOnHand - quantityReserved;

    assertNonNegativeDecimal(quantityOnHand, "quantityOnHand");
    assertNonNegativeDecimal(quantityReserved, "quantityReserved");
    if (!Number.isFinite(quantityAvailable)) {
      throw new Error("quantityAvailable must be a number");
    }
    if (quantityReserved > quantityOnHand) {
      throw new Error("quantityReserved cannot exceed quantityOnHand");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.productId = props.productId;
    this.lotId = props.lotId;
    this.locationId = props.locationId ?? null;
    this.quantityOnHand = quantityOnHand;
    this.quantityReserved = quantityReserved;
    this.quantityAvailable = quantityAvailable;
    this.lastMovementAt = props.lastMovementAt ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: InventoryLotBalanceProps) {
    return new InventoryLotBalanceEntity(props);
  }
}
