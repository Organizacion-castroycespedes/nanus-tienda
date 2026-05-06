import { Expose, Type } from "class-transformer";
import { CashMovementResponseDto } from "./cash-movement-response.dto";

export class CashMovementListSummaryDto {
  @Expose()
  totalIn!: number;

  @Expose()
  totalOut!: number;

  @Expose()
  balance!: number;

  @Expose()
  movementCount!: number;
}

export class CashMovementPaymentMethodSummaryDto {
  @Expose()
  paymentMethodId!: string;

  @Expose()
  paymentMethod!: string;

  @Expose()
  paymentMethodCodigo!: string | null;

  @Expose()
  paymentMethodNombre!: string | null;

  @Expose()
  paymentMethodTipo!: string | null;

  @Expose()
  count!: number;

  @Expose()
  total!: number;
}

export class CashMovementListResponseDto {
  @Expose()
  @Type(() => CashMovementListSummaryDto)
  summary!: CashMovementListSummaryDto;

  @Expose()
  @Type(() => CashMovementPaymentMethodSummaryDto)
  byPaymentMethod!: CashMovementPaymentMethodSummaryDto[];

  @Expose()
  @Type(() => CashMovementResponseDto)
  items!: CashMovementResponseDto[];
}
