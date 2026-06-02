const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

export const INVENTORY_LOCATION_TYPES = [
  "WAREHOUSE",
  "DISPLAY",
  "SHELF",
  "COLD_ROOM",
  "COUNTER",
  "OTHER",
] as const;

export type InventoryLocationType =
  (typeof INVENTORY_LOCATION_TYPES)[number];

export type InventoryLocationProps = {
  id: string;
  tenantId: string;
  branchId: string;
  code: string;
  name: string;
  type?: InventoryLocationType;
  description?: string | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class InventoryLocationEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly code: string;
  readonly name: string;
  readonly type: InventoryLocationType;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: InventoryLocationProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.branchId)) {
      throw new Error("branchId must be a valid UUID");
    }
    if (!props.code?.trim()) {
      throw new Error("code is required");
    }
    if (!props.name?.trim()) {
      throw new Error("name is required");
    }
    if (
      props.type !== undefined &&
      !INVENTORY_LOCATION_TYPES.includes(props.type)
    ) {
      throw new Error("type is invalid");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.code = props.code.trim().toUpperCase();
    this.name = props.name.trim();
    this.type = props.type ?? "OTHER";
    this.description = props.description?.trim() || null;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: InventoryLocationProps) {
    return new InventoryLocationEntity(props);
  }
}
