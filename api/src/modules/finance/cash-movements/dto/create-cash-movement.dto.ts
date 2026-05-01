import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import {
  CASH_MOVEMENT_DIRECTIONS,
  CASH_MOVEMENT_TYPES,
} from "../../entities/cash-movement.entity";
import { IsMonetaryAmount } from "../../common/validators/is-monetary-amount.decorator";

export class CreateCashMovementDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsUUID()
  cashSessionId!: string;

  @IsIn(CASH_MOVEMENT_TYPES)
  movementType!: (typeof CASH_MOVEMENT_TYPES)[number];

  @IsIn(CASH_MOVEMENT_DIRECTIONS)
  direction!: (typeof CASH_MOVEMENT_DIRECTIONS)[number];

  @Type(() => Number)
  @IsMonetaryAmount()
  amount!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(250)
  description?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(50)
  referenceType?: string;

  @IsOptional()
  @IsUUID()
  referenceId?: string;
}
