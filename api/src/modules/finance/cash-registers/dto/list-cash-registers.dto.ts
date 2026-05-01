import { IsBooleanString, IsOptional, IsString, IsUUID } from "class-validator";

export class ListCashRegistersDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsBooleanString()
  activo?: string;
}
