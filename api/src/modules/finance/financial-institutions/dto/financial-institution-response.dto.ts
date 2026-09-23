import { Expose } from "class-transformer";
import type { FinancialInstitutionType } from "../../entities/financial-institution.entity";

export class FinancialInstitutionResponseDto {
  @Expose()
  id!: string;

  @Expose()
  tenantId!: string | null;

  @Expose()
  codigo!: string;

  @Expose()
  nombre!: string;

  @Expose()
  nombreCorto!: string | null;

  @Expose()
  tipo!: FinancialInstitutionType;

  @Expose()
  logoUrl!: string | null;

  @Expose()
  active!: boolean;

  @Expose()
  sortOrder!: number;

  @Expose()
  createdAt!: string;

  @Expose()
  updatedAt!: string;
}
