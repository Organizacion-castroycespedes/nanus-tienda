import { Transform, Type } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { IsMonetaryAmount } from "../../common/validators/is-monetary-amount.decorator";

export class CreateCashSessionAuditDto {
  @Type(() => Number)
  @IsMonetaryAmount({ allowZero: true })
  countedCashAmount!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(500)
  notes?: string;
}
