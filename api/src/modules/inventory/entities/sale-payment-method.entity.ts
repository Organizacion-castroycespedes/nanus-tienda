const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const assertPositiveDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
};

export const SALE_PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "TRANSFER",
  "OTHER",
] as const;

export type SalePaymentMethodType = (typeof SALE_PAYMENT_METHODS)[number];

export type SalePaymentMethodProps = {
  id: string;
  tenantId: string;
  saleId: string;
  paymentMethod: SalePaymentMethodType;
  amount: number;
  reference?: string | null;
  createdAt: Date;
};

export class SalePaymentMethodEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly saleId: string;
  readonly paymentMethod: SalePaymentMethodType;
  readonly amount: number;
  readonly reference: string | null;
  readonly createdAt: Date;

  constructor(props: SalePaymentMethodProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.saleId)) {
      throw new Error("saleId must be a valid UUID");
    }
    if (!SALE_PAYMENT_METHODS.includes(props.paymentMethod)) {
      throw new Error("paymentMethod is invalid");
    }

    assertPositiveDecimal(props.amount, "amount");

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.saleId = props.saleId;
    this.paymentMethod = props.paymentMethod;
    this.amount = props.amount;
    this.reference = props.reference?.trim() || null;
    this.createdAt = props.createdAt;
  }

  static create(props: SalePaymentMethodProps) {
    return new SalePaymentMethodEntity(props);
  }
}

export const SALE_PAYMENT_METHOD_RELATIONS = {
  sale: {
    type: "ManyToOne",
    target: "SaleEntity",
    foreignKey: "sale_id",
  },
} as const;
