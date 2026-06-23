import { Transform, Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

const trimString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class UpdateDeliveryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  customer_name?: string | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  customer_phone?: string | null;

  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  delivery_address?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  delivery_reference?: string | null;

  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  delivery_fee?: number;

  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal?: number;

  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total?: number;

  @IsOptional()
  @IsUUID()
  payment_method_id?: string | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string | null;

  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsObject()
  metadata?: Record<string, unknown>;
}
