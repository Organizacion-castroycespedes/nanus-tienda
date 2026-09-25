import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { FINANCIAL_INSTITUTION_TYPES } from "../../entities/financial-institution.entity";

export class UpdateFinancialInstitutionDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(50)
  codigo?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  nombreCorto?: string;

  @IsOptional()
  @IsIn(FINANCIAL_INSTITUTION_TYPES)
  tipo?: (typeof FINANCIAL_INSTITUTION_TYPES)[number];

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  sortOrder?: number;
}
