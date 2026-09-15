import { Type } from "class-transformer";
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional,
  IsString, IsUUID, Max, MaxLength, Min, ValidateNested,
} from "class-validator";

export class DocumentPaymentLineDto {
  @IsUUID()
  paymentMethodId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2, allowInfinity: false, allowNaN: false })
  @Min(0.01)
  @Max(999999999999.99)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

// Deliberately excludes direction, party, pending balance and arbitrary allocations.
export class CreateDocumentPaymentDto {
  // Optional for legacy callers. New clients should keep this UUID stable while
  // recovering one logical confirmation after an ambiguous network result.
  @IsOptional()
  @IsUUID()
  operationKey?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  cashSessionId!: string;

  @IsIn(["PURCHASE", "SALES_ORDER"])
  referenceType!: "PURCHASE" | "SALES_ORDER";

  @IsUUID()
  referenceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DocumentPaymentLineDto)
  payments!: DocumentPaymentLineDto[];
}
