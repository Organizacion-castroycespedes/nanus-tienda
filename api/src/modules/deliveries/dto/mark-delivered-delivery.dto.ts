import { Transform } from "class-transformer";
import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

const trimString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class MarkDeliveredDeliveryDto {
  @IsOptional()
  @IsDateString()
  delivered_at?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  received_by?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
