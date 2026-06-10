import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  MinLength,
} from "class-validator";

export class ChangeProductPriceDto {
  @IsDefined()
  @IsNumber()
  @Min(0)
  newPrice!: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason!: string;
}
