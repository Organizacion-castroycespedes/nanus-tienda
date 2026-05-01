import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PAYMENT_METHOD_TYPES } from "../../entities/payment-method.entity";

export class CreatePaymentMethodDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(50)
  codigo!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @IsIn(PAYMENT_METHOD_TYPES)
  tipo!: (typeof PAYMENT_METHOD_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  requiresReference?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsChange?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
