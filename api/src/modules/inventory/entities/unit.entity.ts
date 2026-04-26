const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

export type UnitProps = {
  id: string;
  tenantId: string;
  name: string;
  abbreviation: string;
  isActive?: boolean;
};

export class UnitEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly isActive: boolean;

  constructor(props: UnitProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!props.name?.trim()) {
      throw new Error("name is required");
    }
    if (!props.abbreviation?.trim()) {
      throw new Error("abbreviation is required");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name.trim();
    this.abbreviation = props.abbreviation.trim().toUpperCase();
    this.isActive = props.isActive ?? true;
  }

  static create(props: UnitProps) {
    return new UnitEntity(props);
  }
}
