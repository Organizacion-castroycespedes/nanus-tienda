import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class SettlePartialPurchaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivoLiquidacion!: string;
}
