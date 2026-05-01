import { IsOptional, IsUUID } from "class-validator";

export class CurrentCashSessionQueryDto {
  @IsOptional()
  @IsUUID()
  cashRegisterId?: string;
}
