const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const assertNonNegativeDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
};

export type SaleItemTaxProps = {
  id: string;
  tenantId: string;
  saleItemId: string;
  taxId: string;
  taxName: string;
  taxRate: number;
  taxAmount: number;
  isIncluded?: boolean;
  createdAt: Date;
};

export class SaleItemTaxEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly saleItemId: string;
  readonly taxId: string;
  readonly taxName: string;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly isIncluded: boolean;
  readonly createdAt: Date;

  constructor(props: SaleItemTaxProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.saleItemId)) {
      throw new Error("saleItemId must be a valid UUID");
    }
    if (!isUuid(props.taxId)) {
      throw new Error("taxId must be a valid UUID");
    }
    if (!props.taxName?.trim()) {
      throw new Error("taxName is required");
    }

    assertNonNegativeDecimal(props.taxRate, "taxRate");
    assertNonNegativeDecimal(props.taxAmount, "taxAmount");

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.saleItemId = props.saleItemId;
    this.taxId = props.taxId;
    this.taxName = props.taxName.trim();
    this.taxRate = props.taxRate;
    this.taxAmount = props.taxAmount;
    this.isIncluded = props.isIncluded ?? false;
    this.createdAt = props.createdAt;
  }

  static create(props: SaleItemTaxProps) {
    return new SaleItemTaxEntity(props);
  }
}

export const SALE_ITEM_TAX_RELATIONS = {
  saleItem: {
    type: "ManyToOne",
    target: "SaleItemEntity",
    foreignKey: "sale_item_id",
  },
} as const;
