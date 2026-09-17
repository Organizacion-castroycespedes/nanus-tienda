import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PAYMENT_METHOD_TYPES } from "../../entities/payment-method.entity";

export class UpdatePaymentMethodDto {
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
  @IsIn(PAYMENT_METHOD_TYPES)
  tipo?: (typeof PAYMENT_METHOD_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  requiresReference?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsChange?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  electronicBillingEnabled?: boolean;

  @IsOptional()
  @IsIn(["10", "47", "49"])
  electronicPaymentMeansCode?: string;

  @IsOptional()
  @IsIn(["1"])
  electronicPaymentMeansId?: string;
}
