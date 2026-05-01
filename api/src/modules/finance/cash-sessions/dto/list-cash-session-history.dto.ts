import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { CASH_SESSION_STATUSES } from "../../entities/cash-session.entity";

export class ListCashSessionHistoryDto {
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
  @IsIn(CASH_SESSION_STATUSES)
  status?: (typeof CASH_SESSION_STATUSES)[number];

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
}
