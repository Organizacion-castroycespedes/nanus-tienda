export type CorrectSalePaymentItemDto = {
  paymentMethodId: string;
  amount: number;
  reference?: string | null;
  financialInstitutionId?: string | null;
};

export class CorrectSalePaymentsDto {
  reason!: string;
  payments!: CorrectSalePaymentItemDto[];
}
