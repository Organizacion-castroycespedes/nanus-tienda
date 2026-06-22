export type CashSessionPaymentBreakdownDto = {
  paymentMethodId: string;
  paymentMethodNombre: string;
  paymentMethodTipo: string;
  direction: "IN" | "OUT";
  count: number;
  total: number;
};

export type CashSessionMovementBreakdownDto = {
  movementType: string;
  direction: "IN" | "OUT";
  count: number;
  total: number;
};

export type CashSessionRecentMovementDto = {
  id: string;
  movementType: string;
  direction: "IN" | "OUT";
  referenceType: string | null;
  referenceId: string | null;
  amount: number;
  description: string | null;
  createdBy: string;
  createdByEmail: string | null;
  createdAt: string;
};

export type CashSessionLastCountDto = {
  id: string;
  countedCashAmount: number;
  expectedAmount: number;
  differenceAmount: number;
  notes: string | null;
  countedByUserId: string;
  countedByUserEmail: string | null;
  countedAt: string;
} | null;

export type CashSessionDeliverySummaryDto = {
  deliveredCount: number;
  pendingCount: number;
  excludedCount: number;
  deliveredFeeTotal: number;
  byPaymentMethod: Array<{
    paymentMethodId: string | null;
    paymentMethodNombre: string | null;
    count: number;
    total: number;
  }>;
};

export type CashSessionSummaryResponseDto = {
  sessionId: string;
  tenantId: string;
  branchId: string;
  cashRegisterId: string;
  cashRegisterCodigo: string | null;
  cashRegisterNombre: string | null;
  terminalId: string | null;
  terminalName: string | null;
  openedByUserId: string;
  openedByUserEmail: string | null;
  closedByUserId: string | null;
  closedByUserEmail: string | null;
  openedAt: string;
  closedAt: string | null;
  status: string;
  totals: {
    openingAmount: number;
    paymentsIn: number;
    paymentsOut: number;
    expenses: number;
    withdrawals: number;
    adjustmentsIn: number;
    adjustmentsOut: number;
    closingRecorded: number;
    salesPayments: number;
    purchasePayments: number;
    refundPayments: number;
    deliveryFees: number;
    expectedAmount: number;
    netAmount: number;
    movementCount: number;
    paymentCount: number;
  };
  paymentBreakdown: CashSessionPaymentBreakdownDto[];
  movementBreakdown: CashSessionMovementBreakdownDto[];
  recentMovements: CashSessionRecentMovementDto[];
  lastCount: CashSessionLastCountDto;
  deliverySummary: CashSessionDeliverySummaryDto;
};
