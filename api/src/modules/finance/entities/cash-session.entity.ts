import {
  assertNonNegativeDecimal,
  isOptionalUuid,
  isUuid,
} from "./entity-utils";

export const CASH_SESSION_STATUSES = ["OPEN", "CLOSED", "CANCELLED"] as const;
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];

export type CashSessionProps = {
  id: string;
  tenantId: string;
  branchId: string;
  cashRegisterId: string;
  openedByUserId: string;
  closedByUserId?: string | null;
  openedAt: Date;
  closedAt?: Date | null;
  openingAmount: number;
  closingAmount?: number | null;
  expectedAmount?: number | null;
  differenceAmount?: number | null;
  status?: CashSessionStatus;
  createdAt: Date;
};

export class CashSessionEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly cashRegisterId: string;
  readonly openedByUserId: string;
  readonly closedByUserId: string | null;
  readonly openedAt: Date;
  readonly closedAt: Date | null;
  readonly openingAmount: number;
  readonly closingAmount: number | null;
  readonly expectedAmount: number | null;
  readonly differenceAmount: number | null;
  readonly status: CashSessionStatus;
  readonly createdAt: Date;

  constructor(props: CashSessionProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.tenantId)) {
      throw new Error("tenantId must be a valid UUID");
    }
    if (!isUuid(props.branchId)) {
      throw new Error("branchId must be a valid UUID");
    }
    if (!isUuid(props.cashRegisterId)) {
      throw new Error("cashRegisterId must be a valid UUID");
    }
    if (!isUuid(props.openedByUserId)) {
      throw new Error("openedByUserId must be a valid UUID");
    }
    if (!isOptionalUuid(props.closedByUserId)) {
      throw new Error("closedByUserId must be a valid UUID");
    }

    const status = props.status ?? "OPEN";
    if (!CASH_SESSION_STATUSES.includes(status)) {
      throw new Error("status is invalid");
    }

    assertNonNegativeDecimal(props.openingAmount, "openingAmount");
    if (props.closingAmount != null) {
      assertNonNegativeDecimal(props.closingAmount, "closingAmount");
    }
    if (props.expectedAmount != null) {
      assertNonNegativeDecimal(props.expectedAmount, "expectedAmount");
    }
    if (props.closedAt && props.closedAt.getTime() < props.openedAt.getTime()) {
      throw new Error("closedAt cannot be before openedAt");
    }

    if (status === "OPEN") {
      if (props.closedAt != null || props.closedByUserId != null) {
        throw new Error("open sessions cannot have closing data");
      }
      if (
        props.closingAmount != null ||
        props.expectedAmount != null ||
        props.differenceAmount != null
      ) {
        throw new Error("open sessions cannot have reconciliation amounts");
      }
    }

    if (status === "CLOSED") {
      if (props.closedAt == null || props.closedByUserId == null) {
        throw new Error("closed sessions require closing metadata");
      }
      if (props.closingAmount == null) {
        throw new Error("closed sessions require closingAmount");
      }
    }

    if (status === "CANCELLED" && (props.closedAt == null || props.closedByUserId == null)) {
      throw new Error("cancelled sessions require closing metadata");
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.cashRegisterId = props.cashRegisterId;
    this.openedByUserId = props.openedByUserId;
    this.closedByUserId = props.closedByUserId?.trim() || null;
    this.openedAt = props.openedAt;
    this.closedAt = props.closedAt ?? null;
    this.openingAmount = props.openingAmount;
    this.closingAmount = props.closingAmount ?? null;
    this.expectedAmount = props.expectedAmount ?? null;
    this.differenceAmount = props.differenceAmount ?? null;
    this.status = status;
    this.createdAt = props.createdAt;
  }

  static create(props: CashSessionProps) {
    return new CashSessionEntity(props);
  }
}

export const CASH_SESSION_RELATIONS = {
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
  cashRegister: {
    type: "ManyToOne",
    target: "CashRegisterEntity",
    foreignKey: "cash_register_id",
  },
  openedByUser: {
    type: "ManyToOne",
    target: "UserEntity",
    foreignKey: "opened_by_user_id",
  },
  closedByUser: {
    type: "ManyToOne",
    target: "UserEntity",
    foreignKey: "closed_by_user_id",
  },
} as const;
