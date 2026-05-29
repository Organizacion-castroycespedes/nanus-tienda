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

export type StockMovementLotProps = {
  id: string;
  tenantId: string;
  stockMovementId: string;
  productId: string;
  lotId?: string | null;
  locationId?: string | null;
  quantity: number;
  createdAt: Date;
};

export class StockMovementLotEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly stockMovementId: string;
  readonly productId: string;
  readonly lotId: string | null;
  readonly locationId: string | null;
  readonly quantity: number;
  readonly createdAt: Date;

  constructor(props: StockMovementLotProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.stockMovementId)) {
      throw new Error("stockMovementId must be a valid UUID");
    }
    if (!isUuid(props.productId)) {
      throw new Error("productId must be a valid UUID");
    }
    assertOptionalUuid(props.lotId, "lotId");
    assertOptionalUuid(props.locationId, "locationId");
    if (!Number.isFinite(props.quantity) || props.quantity <= 0) {
      throw new Error("quantity must be greater than zero");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.stockMovementId = props.stockMovementId;
    this.productId = props.productId;
    this.lotId = props.lotId ?? null;
    this.locationId = props.locationId ?? null;
    this.quantity = props.quantity;
    this.createdAt = props.createdAt;
  }

  static create(props: StockMovementLotProps) {
    return new StockMovementLotEntity(props);
  }
}
