import { Expose } from "class-transformer";

export class CashRegisterResponseDto {
  @Expose()
  id!: string;

  @Expose()
  tenantId!: string;

  @Expose()
  branchId!: string;

  @Expose()
  branchNombre!: string | null;

  @Expose()
  terminalId!: string | null;

  @Expose()
  terminalNombre!: string | null;

  @Expose()
  codigo!: string;

  @Expose()
  nombre!: string;

  @Expose()
  activo!: boolean;

  @Expose()
  createdAt!: string;

  @Expose()
  updatedAt!: string;
}
