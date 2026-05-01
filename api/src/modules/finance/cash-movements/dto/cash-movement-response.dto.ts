import { Expose } from "class-transformer";

export class CashMovementResponseDto {
  @Expose()
  id!: string;

  @Expose()
  tenantId!: string;

  @Expose()
  branchId!: string;

  @Expose()
  cashSessionId!: string;

  @Expose()
  cashRegisterId!: string | null;

  @Expose()
  cashRegisterNombre!: string | null;

  @Expose()
  movementType!: string;

  @Expose()
  direction!: string;

  @Expose()
  referenceType!: string | null;

  @Expose()
  referenceId!: string | null;

  @Expose()
  amount!: number;

  @Expose()
  description!: string | null;

  @Expose()
  createdBy!: string;

  @Expose()
  createdByEmail!: string | null;

  @Expose()
  createdAt!: string;
}
