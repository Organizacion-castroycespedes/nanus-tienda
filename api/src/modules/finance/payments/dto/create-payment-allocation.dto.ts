import { IsIn, IsUUID } from "class-validator";
import { Type } from "class-transformer";
import { IsMonetaryAmount } from "../../common/validators/is-monetary-amount.decorator";
import { PAYMENT_REFERENCE_TYPES } from "../../entities/payment.entity";

export class CreatePaymentAllocationDto {
  @IsIn(PAYMENT_REFERENCE_TYPES)
  referenceType!: (typeof PAYMENT_REFERENCE_TYPES)[number];

  @IsUUID()
  referenceId!: string;

  @Type(() => Number)
  @IsMonetaryAmount()
  allocatedAmount!: number;
}
