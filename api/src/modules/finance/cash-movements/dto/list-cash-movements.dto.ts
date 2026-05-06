import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import {
  CASH_MOVEMENT_DIRECTIONS,
  CASH_MOVEMENT_TYPES,
} from "../../entities/cash-movement.entity";

export class ListCashMovementsDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  cashRegisterId?: string;

  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @IsOptional()
  @IsIn(CASH_MOVEMENT_TYPES)
  movementType?: (typeof CASH_MOVEMENT_TYPES)[number];

  @IsOptional()
  @IsIn(CASH_MOVEMENT_DIRECTIONS)
  direction?: (typeof CASH_MOVEMENT_DIRECTIONS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeSummary?: boolean;
}
