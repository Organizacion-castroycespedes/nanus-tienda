import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class OperationalDebitNoteDto {
  @IsString()
  @MinLength(5, { message: "El motivo debe tener al menos 5 caracteres" })
  reason!: string;

  @IsString()
  @IsIn(["1", "2", "3", "4"], {
    message: "Código de discrepancia DIAN inválido (1: Intereses, 2: Gastos por cobrar, 3: Cambio de valor, 4: Otros)",
  })
  discrepancyResponseCode!: string;

  @IsOptional()
  @IsString()
  discrepancyResponseDescription?: string;

  @IsNumber()
  @IsPositive({ message: "El monto debe ser mayor a 0" })
  amount!: number;
}
