import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

const trimString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateDeliveryDriverDto {
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  document_number?: string | null;

  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string | null;
}
