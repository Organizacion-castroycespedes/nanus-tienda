import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { IsMonetaryAmount } from "../../common/validators/is-monetary-amount.decorator";
import {
  PAYMENT_DIRECTIONS,
  PAYMENT_REFERENCE_TYPES,
  PAYMENT_STATUSES,
} from "../../entities/payment.entity";
import { CreatePaymentAllocationDto } from "./create-payment-allocation.dto";

export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  paymentMethodId!: string;

  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @IsIn(PAYMENT_REFERENCE_TYPES)
  referenceType!: (typeof PAYMENT_REFERENCE_TYPES)[number];

  @IsUUID()
  referenceId!: string;

  @IsIn(PAYMENT_DIRECTIONS)
  direction!: (typeof PAYMENT_DIRECTIONS)[number];

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number];

  @Type(() => Number)
  @IsMonetaryAmount()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  paidByPersonId?: string;

  @IsOptional()
  @IsBoolean()
  allowOverpayment?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentAllocationDto)
  allocations?: CreatePaymentAllocationDto[];
}
