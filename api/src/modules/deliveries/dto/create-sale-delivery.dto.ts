import { Transform, Type } from "class-transformer";
import {
  IsNumber,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

const trimString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateSaleDeliveryDto {
  @IsOptional()
  @IsIn(["INVOICE_INCLUDED", "NO_FEE"])
  delivery_fee_source?: "INVOICE_INCLUDED" | "NO_FEE";

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  customer_name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  customer_phone?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  delivery_address?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  delivery_reference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  delivery_fee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total?: number;

  @IsOptional()
  @IsUUID()
  payment_method_id?: string;

  @IsOptional()
  @IsUUID()
  driver_id?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
