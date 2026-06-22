import type { ReportActorContext } from "./sales-report.types";

export type { ReportActorContext };

export type CashClosingListRow = {
  cashSessionId: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  tenantName: string | null;
  branchId: string;
  branchName: string | null;
  cashRegister: string | null;
  cashRegisterCode: string | null;
  terminal: string | null;
  openedBy: string | null;
  closedBy: string | null;
  openingAmount: number;
  totalIn: number;
  totalOut: number;
  expectedAmount: number;
  closingAmount: number;
  difference: number;
};

export type CashClosingListDataset = {
  filters: {
    tenantId: string;
    branchId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    actorRole: string;
  };
  summary: {
    count: number;
    openingAmount: number;
    totalIn: number;
    totalOut: number;
    expectedAmount: number;
    closingAmount: number;
    difference: number;
  };
  rows: CashClosingListRow[];
};

export type CashClosingTicketDataset = {
  header: {
    cashSessionId: string;
    tenantName: string | null;
    branchId: string;
    branchName: string | null;
    cashRegisterId: string;
    cashRegister: string | null;
    cashRegisterCode: string | null;
    terminalId: string | null;
    terminal: string | null;
    openedByUserId: string;
    openedBy: string | null;
    closedByUserId: string | null;
    closedBy: string | null;
    openedAt: string;
    closedAt: string | null;
    status: string;
  };
  totals: {
    openingAmount: number;
    posSalesPayments: number;
    orderSalesPayments: number;
    totalIn: number;
    paymentsIn: number;
    paymentsOut: number;
    refundPayments: number;
    purchasePayments: number;
    expenses: number;
    withdrawals: number;
    adjustmentsIn: number;
    adjustmentsOut: number;
    closingRecorded: number;
    totalOut: number;
    expectedAmount: number;
    closingAmount: number;
    difference: number;
  };
  paymentBreakdown: Array<{
    paymentMethodId: string;
    paymentMethodNombre: string;
    paymentMethodTipo: string;
    direction: string;
    count: number;
    total: number;
  }>;
  deliverySummary: {
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
  movementBreakdown: Array<{
    movementType: string;
    direction: string;
    count: number;
    total: number;
  }>;
  recentMovements: Array<{
    id: string;
    movementType: string;
    direction: string;
    referenceType: string | null;
    referenceId: string | null;
    amount: number;
    description: string | null;
    createdBy: string;
    createdByEmail: string | null;
    createdAt: string;
  }>;
  lastCount?: {
    id: string;
    countedCashAmount: number;
    expectedAmount: number;
    differenceAmount: number;
    notes: string | null;
    countedByUserId: string;
    countedByUserEmail: string | null;
    countedAt: string;
  } | null;
};

export type CashAuditListRow = {
  cashCountId: string;
  cashSessionId: string;
  branchId: string;
  branchName: string | null;
  cashRegister: string | null;
  terminal: string | null;
  countedAt: string;
  countedAmount: number;
  expectedAmount: number;
  difference: number;
  countedByUserId: string;
  countedBy: string | null;
  notes: string | null;
  sessionStatus: string;
  openedAt: string;
  closedAt: string | null;
};

export type CashAuditListDataset = {
  filters: {
    tenantId: string;
    branchId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    actorRole: string;
  };
  summary: {
    count: number;
    countedAmount: number;
    expectedAmount: number;
    difference: number;
  };
  rows: CashAuditListRow[];
};

export type CashAuditTicketDataset = {
  header: {
    cashCountId: string;
    cashSessionId: string;
    tenantName: string | null;
    branchId: string;
    branchName: string | null;
    cashRegisterId: string;
    cashRegister: string | null;
    cashRegisterCode: string | null;
    terminalId: string | null;
    terminal: string | null;
    sessionStatus: string;
    openedAt: string;
    closedAt: string | null;
    openedByUserId: string;
    openedBy: string | null;
    closedByUserId: string | null;
    closedBy: string | null;
    countedAt: string;
    countedByUserId: string;
    countedBy: string | null;
  };
  audit: {
    countedAmount: number;
    expectedAmount: number;
    difference: number;
    notes: string | null;
  };
  sessionTotals: {
    openingAmount: number;
    posSalesPayments: number;
    orderSalesPayments: number;
    refundPayments: number;
    expectedAmount: number;
  };
};
