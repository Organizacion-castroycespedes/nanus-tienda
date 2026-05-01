import { Transform } from "class-transformer";
import { IsBooleanString, IsOptional, IsString } from "class-validator";

export class ListPaymentMethodsDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsBooleanString()
  active?: string;
}
