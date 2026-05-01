import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  MaxLength,
} from "class-validator";

export class UpdateCashRegisterDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @ValidateIf((_object: object, value: unknown) => value !== null && value !== undefined)
  @IsUUID()
  terminalId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(50)
  codigo?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
