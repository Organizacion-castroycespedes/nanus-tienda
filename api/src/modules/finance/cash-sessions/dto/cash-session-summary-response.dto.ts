export type CashSessionPaymentBreakdownDto = {
  paymentMethodId: string;
  paymentMethodNombre: string;
  paymentMethodTipo: string;
  direction: "IN" | "OUT";
  count: number;
  total: number;
};

export type CashSessionPaymentCategoryDto =
  | "CASH"
  | "CARD"
  | "TRANSFER"
  | "DIGITAL"
  | "OTHER";

export type CashSessionPaymentMethodDetailDto = {
  paymentMethodId: string | null;
  paymentMethodNombre: string;
  paymentMethodTipo: string | null;
  category: CashSessionPaymentCategoryDto;
  isCash: boolean;
  count: number;
  sales: number;
  orders: number;
  purchases: number;
  refunds: number;
  deliveries: number;
  manualIn: number;
  manualOut: number;
  otherIn: number;
  otherOut: number;
  totalIn: number;
  totalOut: number;
  net: number;
};

export type CashSessionSourceBreakdownDto = {
  opening: number;
  posSales: number;
  orders: number;
  purchases: number;
  refunds: number;
  deliveries: number;
  manualIn: number;
  manualOut: number;
  otherIn: number;
  otherOut: number;
  totalIn: number;
  totalOut: number;
  net: number;
};

export type CashSessionCashControlDto = {
  openingCash: number;
  cashPaymentsIn: number;
  cashPaymentsOut: number;
  cashDeliveryFees: number;
  cashManualIn: number;
  cashManualOut: number;
  expectedCashAmount: number;
  countedCashAmount: number | null;
  differenceAmount: number | null;
  nonCashNet: number;
  totalNetAmount: number;
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
  countType?: "AUDIT" | "CLOSING";
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
    paymentMethodTipo?: string | null;
    count: number;
    total: number;
  }>;
};

export type CashSessionAuditRecordDto = {
  id: string;
  countType: "AUDIT" | "CLOSING";
  countedCashAmount: number;
  expectedAmount: number;
  differenceAmount: number;
  notes: string | null;
  countedByUserId: string;
  countedByUserEmail: string | null;
  countedAt: string;
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
  paymentMethodDetails: CashSessionPaymentMethodDetailDto[];
  sourceBreakdown: CashSessionSourceBreakdownDto;
  cashControl: CashSessionCashControlDto;
  movementBreakdown: CashSessionMovementBreakdownDto[];
  recentMovements: CashSessionRecentMovementDto[];
  lastCount: CashSessionLastCountDto;
  auditRecords: CashSessionAuditRecordDto[];
  deliverySummary: CashSessionDeliverySummaryDto;
};
