import { Transform } from "class-transformer";
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

const trimString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class AssignDeliveryDto {
  @IsOptional()
  @IsUUID()
  assigned_courier_id?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
