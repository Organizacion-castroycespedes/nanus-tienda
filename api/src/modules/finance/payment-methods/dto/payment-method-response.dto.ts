import { Expose } from "class-transformer";
import type { PaymentMethodType } from "../../entities/payment-method.entity";

export class PaymentMethodResponseDto {
  @Expose()
  id!: string;

  @Expose()
  tenantId!: string;

  @Expose()
  codigo!: string;

  @Expose()
  nombre!: string;

  @Expose()
  tipo!: PaymentMethodType;

  @Expose()
  requiresReference!: boolean;

  @Expose()
  allowsChange!: boolean;

  @Expose()
  active!: boolean;

  @Expose()
  createdAt!: string;

  @Expose()
  updatedAt!: string;
}
