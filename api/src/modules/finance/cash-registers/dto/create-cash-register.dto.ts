import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateCashRegisterDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsUUID()
  terminalId?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(50)
  codigo!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
