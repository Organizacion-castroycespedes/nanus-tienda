import { Expose, Type } from "class-transformer";
import type {
  PaymentDirection,
  PaymentReferenceType,
  PaymentStatus,
} from "../../entities/payment.entity";

export class PaymentAllocationResponseDto {
  @Expose()
  id!: string;

  @Expose()
  paymentId!: string;

  @Expose()
  referenceType!: PaymentReferenceType;

  @Expose()
  referenceId!: string;

  @Expose()
  allocatedAmount!: number;

  @Expose()
  createdAt!: string;
}

export class PaymentResponseDto {
  @Expose()
  id!: string;

  @Expose()
  tenantId!: string;

  @Expose()
  branchId!: string;

  @Expose()
  paymentMethodId!: string;

  @Expose()
  paymentMethodCodigo!: string | null;

  @Expose()
  paymentMethodNombre!: string | null;

  @Expose()
  paymentMethodTipo!: string | null;

  @Expose()
  cashSessionId!: string | null;

  @Expose()
  cashRegisterId!: string | null;

  @Expose()
  cashRegisterNombre!: string | null;

  @Expose()
  referenceType!: PaymentReferenceType;

  @Expose()
  referenceId!: string;

  @Expose()
  direction!: PaymentDirection;

  @Expose()
  status!: PaymentStatus;

  @Expose()
  amount!: number;

  @Expose()
  allocatedAmount!: number;

  @Expose()
  unallocatedAmount!: number;

  @Expose()
  referenceNumber!: string | null;

  @Expose()
  notes!: string | null;

  @Expose()
  paidByPersonId!: string | null;

  @Expose()
  paidByPersonName!: string | null;

  @Expose()
  createdBy!: string;

  @Expose()
  createdByEmail!: string | null;

  @Expose()
  createdAt!: string;

  @Expose()
  @Type(() => PaymentAllocationResponseDto)
  allocations!: PaymentAllocationResponseDto[];
}
