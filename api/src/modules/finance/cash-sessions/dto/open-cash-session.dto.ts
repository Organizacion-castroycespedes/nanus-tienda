import { Type } from "class-transformer";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { IsMonetaryAmount } from "../../common/validators/is-monetary-amount.decorator";

export class OpenCashSessionDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  cashRegisterId!: string;

  @Type(() => Number)
  @IsMonetaryAmount({ allowZero: true })
  openingAmount!: number;
}
