import {
  assertOptionalLength,
  assertPositiveDecimal,
  isOptionalUuid,
  isUuid,
  normalizeOptionalText,
} from "./entity-utils";

export const PAYMENT_REFERENCE_TYPES = [
  "SALE",
  "PURCHASE",
  "SALES_ORDER",
  "PURCHASE_ORDER",
  "EXPENSE",
  "REFUND",
  "CUSTOMER_CREDIT",
  "SUPPLIER_CREDIT",
] as const;

export type PaymentReferenceType = (typeof PAYMENT_REFERENCE_TYPES)[number];

export const PAYMENT_DIRECTIONS = ["IN", "OUT"] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentProps = {
  id: string;
  tenantId: string;
  branchId: string;
  paymentMethodId: string;
  cashSessionId?: string | null;
  referenceType: PaymentReferenceType;
  referenceId: string;
  direction: PaymentDirection;
  status?: PaymentStatus;
  amount: number;
  referenceNumber?: string | null;
  notes?: string | null;
  paidByPersonId?: string | null;
  createdBy: string;
  createdAt: Date;
};

export class PaymentEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly paymentMethodId: string;
  readonly cashSessionId: string | null;
  readonly referenceType: PaymentReferenceType;
  readonly referenceId: string;
  readonly direction: PaymentDirection;
  readonly status: PaymentStatus;
  readonly amount: number;
  readonly referenceNumber: string | null;
  readonly notes: string | null;
  readonly paidByPersonId: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;

  constructor(props: PaymentProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.branchId)) {
      throw new Error("branchId must be a valid UUID");
    }
    if (!isUuid(props.paymentMethodId)) {
      throw new Error("paymentMethodId must be a valid UUID");
    }
    if (!isOptionalUuid(props.cashSessionId)) {
      throw new Error("cashSessionId must be a valid UUID");
    }
    if (!PAYMENT_REFERENCE_TYPES.includes(props.referenceType)) {
      throw new Error("referenceType is invalid");
    }
    if (!isUuid(props.referenceId)) {
      throw new Error("referenceId must be a valid UUID");
    }
    if (!PAYMENT_DIRECTIONS.includes(props.direction)) {
      throw new Error("direction is invalid");
    }
    if (props.status !== undefined && !PAYMENT_STATUSES.includes(props.status)) {
      throw new Error("status is invalid");
    }
    if (!isOptionalUuid(props.paidByPersonId)) {
      throw new Error("paidByPersonId must be a valid UUID");
    }
    if (!isUuid(props.createdBy)) {
      throw new Error("createdBy must be a valid UUID");
    }

    assertPositiveDecimal(props.amount, "amount");
    assertOptionalLength(props.referenceNumber, "referenceNumber", 120);
    assertOptionalLength(props.notes, "notes", 1000);

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.paymentMethodId = props.paymentMethodId;
    this.cashSessionId = props.cashSessionId?.trim() || null;
    this.referenceType = props.referenceType;
    this.referenceId = props.referenceId;
    this.direction = props.direction;
    this.status = props.status ?? "COMPLETED";
    this.amount = props.amount;
    this.referenceNumber = normalizeOptionalText(props.referenceNumber);
    this.notes = normalizeOptionalText(props.notes);
    this.paidByPersonId = props.paidByPersonId?.trim() || null;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
  }

  static create(props: PaymentProps) {
    return new PaymentEntity(props);
  }
}

export const PAYMENT_RELATIONS = {
  tenant: {
    type: "ManyToOne",
    target: "TenantEntity",
    foreignKey: "tenant_id",
  },
  branch: {
    type: "ManyToOne",
    target: "BranchEntity",
    foreignKey: "branch_id",
  },
  paymentMethod: {
    type: "ManyToOne",
    target: "PaymentMethodEntity",
    foreignKey: "payment_method_id",
  },
  cashSession: {
    type: "ManyToOne",
    target: "CashSessionEntity",
    foreignKey: "cash_session_id",
  },
  paidByPerson: {
    type: "ManyToOne",
    target: "PersonaEntity",
    foreignKey: "paid_by_person_id",
  },
  createdByUser: {
    type: "ManyToOne",
    target: "UserEntity",
    foreignKey: "created_by",
  },
} as const;
