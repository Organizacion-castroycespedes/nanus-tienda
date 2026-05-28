import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CancelPurchaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivoCancelacion!: string;
}
