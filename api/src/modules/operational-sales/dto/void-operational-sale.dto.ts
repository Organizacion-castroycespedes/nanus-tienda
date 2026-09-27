import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class VoidOperationalSaleDto {
  @IsString()
  @MinLength(5, { message: "El motivo de anulación debe tener al menos 5 caracteres" })
  reason!: string;

  @IsOptional()
  @IsString()
  @IsIn(["1", "2", "3", "4", "5"])
  discrepancyResponseCode?: string;

  @IsOptional()
  @IsString()
  discrepancyResponseDescription?: string;

  @IsOptional()
  @IsBoolean()
  returnInventory?: boolean;
}
