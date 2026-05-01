import { Expose } from "class-transformer";

export class CashSessionResponseDto {
  @Expose()
  id!: string;

  @Expose()
  tenantId!: string;

  @Expose()
  branchId!: string;

  @Expose()
  cashRegisterId!: string;

  @Expose()
  cashRegisterCodigo!: string | null;

  @Expose()
  cashRegisterNombre!: string | null;

  @Expose()
  openedByUserId!: string;

  @Expose()
  openedByUserEmail!: string | null;

  @Expose()
  closedByUserId!: string | null;

  @Expose()
  closedByUserEmail!: string | null;

  @Expose()
  openedAt!: string;

  @Expose()
  closedAt!: string | null;

  @Expose()
  openingAmount!: number;

  @Expose()
  closingAmount!: number | null;

  @Expose()
  expectedAmount!: number | null;

  @Expose()
  differenceAmount!: number | null;

  @Expose()
  status!: string;

  @Expose()
  createdAt!: string;
}
