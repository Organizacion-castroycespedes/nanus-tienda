import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import {
  PAYMENT_DIRECTIONS,
  PAYMENT_REFERENCE_TYPES,
  PAYMENT_STATUSES,
} from "../../entities/payment.entity";

export class ListPaymentsDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @IsOptional()
  @IsIn(PAYMENT_REFERENCE_TYPES)
  referenceType?: (typeof PAYMENT_REFERENCE_TYPES)[number];

  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  @IsIn(PAYMENT_DIRECTIONS)
  direction?: (typeof PAYMENT_DIRECTIONS)[number];

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number];

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
