const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const assertValidRate = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("rate must be a non-negative number");
  }
};

export type TaxProps = {
  id: string;
  tenantId: string;
  name: string;
  rate: number;
  isIncluded: boolean;
  isActive?: boolean;
  taxTypeId?: string | null;
  calculationMethodId?: string | null;
  taxBaseTypeId?: string | null;
  taxTypeCode?: string | null;
  taxTypeDianCode?: string | null;
  calculationMethodCode?: string | null;
  taxBaseTypeCode?: string | null;
};

export class TaxEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly rate: number;
  readonly isIncluded: boolean;
  readonly isActive: boolean;
  readonly taxTypeId: string | null;
  readonly calculationMethodId: string | null;
  readonly taxBaseTypeId: string | null;
  readonly taxTypeCode: string | null;
  readonly taxTypeDianCode: string | null;
  readonly calculationMethodCode: string | null;
  readonly taxBaseTypeCode: string | null;

  constructor(props: TaxProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!props.name?.trim()) {
      throw new Error("name is required");
    }

    assertValidRate(props.rate);

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name.trim();
    this.rate = props.rate;
    this.isIncluded = props.isIncluded;
    this.isActive = props.isActive ?? true;
    this.taxTypeId = props.taxTypeId ?? null;
    this.calculationMethodId = props.calculationMethodId ?? null;
    this.taxBaseTypeId = props.taxBaseTypeId ?? null;
    this.taxTypeCode = props.taxTypeCode ?? null;
    this.taxTypeDianCode = props.taxTypeDianCode ?? null;
    this.calculationMethodCode = props.calculationMethodCode ?? null;
    this.taxBaseTypeCode = props.taxBaseTypeCode ?? null;
  }

  static create(props: TaxProps) {
    return new TaxEntity(props);
  }
}
