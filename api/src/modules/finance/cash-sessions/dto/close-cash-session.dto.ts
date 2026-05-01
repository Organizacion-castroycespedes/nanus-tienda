import { Transform, Type } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { IsMonetaryAmount } from "../../common/validators/is-monetary-amount.decorator";

export class CloseCashSessionDto {
  @Type(() => Number)
  @IsMonetaryAmount({ allowZero: true })
  closingAmount!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(250)
  description?: string;
}
