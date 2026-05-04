import {
  assertOptionalLength,
  assertPositiveDecimal,
  isUuid,
  normalizeOptionalText,
} from "./entity-utils";

export const CASH_MOVEMENT_DIRECTIONS = ["IN", "OUT"] as const;
export type CashMovementDirection = (typeof CASH_MOVEMENT_DIRECTIONS)[number];

export const CASH_MOVEMENT_TYPES = [
  "OPENING",
  "CLOSING",
  "ADJUSTMENT",
  "EXPENSE",
  "WITHDRAWAL",
  "PAYMENT",
] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export type CashMovementProps = {
  id: string;
  tenantId: string;
  branchId: string;
  cashSessionId: string;
  paymentId?: string | null;
  movementType: CashMovementType;
  direction: CashMovementDirection;
  referenceType?: string | null;
  referenceId?: string | null;
  amount: number;
  description?: string | null;
  createdBy: string;
  createdAt: Date;
};

export class CashMovementEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly cashSessionId: string;
  readonly paymentId: string | null;
  readonly movementType: CashMovementType;
  readonly direction: CashMovementDirection;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly amount: number;
  readonly description: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;

  constructor(props: CashMovementProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.branchId)) {
      throw new Error("branchId must be a valid UUID");
    }
    if (!isUuid(props.cashSessionId)) {
      throw new Error("cashSessionId must be a valid UUID");
    }
    if (props.paymentId != null && !isUuid(props.paymentId)) {
      throw new Error("paymentId must be a valid UUID");
    }
    if (!isUuid(props.createdBy)) {
      throw new Error("createdBy must be a valid UUID");
    }
    if (!CASH_MOVEMENT_TYPES.includes(props.movementType)) {
      throw new Error("movementType is invalid");
    }
    if (!CASH_MOVEMENT_DIRECTIONS.includes(props.direction)) {
      throw new Error("direction is invalid");
    }
    assertPositiveDecimal(props.amount, "amount");
    assertOptionalLength(props.referenceType, "referenceType", 50);
    assertOptionalLength(props.referenceId, "referenceId", 120);

    const referenceType = normalizeOptionalText(props.referenceType);
    const referenceId = normalizeOptionalText(props.referenceId);
    if ((referenceType == null) !== (referenceId == null)) {
      throw new Error("referenceType and referenceId must be provided together");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.cashSessionId = props.cashSessionId;
    this.paymentId = props.paymentId ?? null;
    this.movementType = props.movementType;
    this.direction = props.direction;
    this.referenceType = referenceType;
    this.referenceId = referenceId;
    this.amount = props.amount;
    this.description = normalizeOptionalText(props.description);
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
  }

  static create(props: CashMovementProps) {
    return new CashMovementEntity(props);
  }
}

export const CASH_MOVEMENT_RELATIONS = {
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
  cashSession: {
    type: "ManyToOne",
    target: "CashSessionEntity",
    foreignKey: "cash_session_id",
  },
  payment: {
    type: "ManyToOne",
    target: "PaymentEntity",
    foreignKey: "payment_id",
  },
  createdByUser: {
    type: "ManyToOne",
    target: "UserEntity",
    foreignKey: "created_by",
  },
} as const;
