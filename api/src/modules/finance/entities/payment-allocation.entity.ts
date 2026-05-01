import { assertPositiveDecimal, isUuid } from "./entity-utils";
import {
  PAYMENT_REFERENCE_TYPES,
  type PaymentReferenceType,
} from "./payment.entity";

export type PaymentAllocationProps = {
  id: string;
  paymentId: string;
  referenceType: PaymentReferenceType;
  referenceId: string;
  allocatedAmount: number;
  createdAt: Date;
};

export class PaymentAllocationEntity {
  readonly id: string;
  readonly paymentId: string;
  readonly referenceType: PaymentReferenceType;
  readonly referenceId: string;
  readonly allocatedAmount: number;
  readonly createdAt: Date;

  constructor(props: PaymentAllocationProps) {
    if (!isUuid(props.id)) {
      throw new Error("id must be a valid UUID");
    }
    if (!isUuid(props.paymentId)) {
      throw new Error("paymentId must be a valid UUID");
    }
    if (!PAYMENT_REFERENCE_TYPES.includes(props.referenceType)) {
      throw new Error("referenceType is invalid");
    }
    if (!isUuid(props.referenceId)) {
      throw new Error("referenceId must be a valid UUID");
    }

    assertPositiveDecimal(props.allocatedAmount, "allocatedAmount");

    this.id = props.id;
    this.paymentId = props.paymentId;
    this.referenceType = props.referenceType;
    this.referenceId = props.referenceId;
    this.allocatedAmount = props.allocatedAmount;
    this.createdAt = props.createdAt;
  }

  static create(props: PaymentAllocationProps) {
    return new PaymentAllocationEntity(props);
  }
}

export const PAYMENT_ALLOCATION_RELATIONS = {
  payment: {
    type: "ManyToOne",
    target: "PaymentEntity",
    foreignKey: "payment_id",
  },
} as const;
