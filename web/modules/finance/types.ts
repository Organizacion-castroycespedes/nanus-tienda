export type FinanceRole =
  | "SUPER_ADMIN"
  | "SUPER_USER"
  | "ADMIN"
  | "USER"
  | string;

export type FinanceTenantOption = {
  id: string;
  name: string;
};

export type FinanceBranchOption = {
  id: string;
  tenantId: string;
  name: string;
  status?: string;
};

export type FinanceTerminalOption = {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type PaymentMethodType = "CASH" | "CARD" | "BANK" | "DIGITAL" | "CREDIT";
export type FinancePaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERPAID";
export type PaymentDirection = "IN" | "OUT";
export type PaymentStatus = "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
export type PaymentReferenceType =
  | "SALE"
  | "PURCHASE"
  | "SALES_ORDER"
  | "PURCHASE_ORDER"
  | "EXPENSE"
  | "REFUND"
  | "CUSTOMER_CREDIT"
  | "SUPPLIER_CREDIT";

export type PaymentMethod = {
  id: string;
  tenantId: string;
  codigo: string;
  nombre: string;
  tipo: PaymentMethodType;
  requiresReference: boolean;
  allowsChange: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CashRegister = {
  id: string;
  tenantId: string;
  branchId: string;
  branchNombre: string | null;
  terminalId: string | null;
  terminalNombre: string | null;
  codigo: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CashSessionStatus = "OPEN" | "CLOSED" | "CANCELLED";

export type CashSession = {
  id: string;
  tenantId: string;
  branchId: string;
  cashRegisterId: string;
  cashRegisterCodigo: string | null;
  cashRegisterNombre: string | null;
  openedByUserId: string;
  openedByUserEmail: string | null;
  closedByUserId: string | null;
  closedByUserEmail: string | null;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  differenceAmount: number | null;
  status: CashSessionStatus;
  createdAt: string;
};

export type CashSessionPaymentBreakdown = {
  paymentMethodId: string;
  paymentMethodNombre: string;
  paymentMethodTipo: string;
  direction: PaymentDirection;
  count: number;
  total: number;
};

export type CashSessionMovementBreakdown = {
  movementType: CashMovementType | string;
  direction: CashMovementDirection;
  count: number;
  total: number;
};

export type CashSessionRecentMovement = {
  id: string;
  movementType: CashMovementType | string;
  direction: CashMovementDirection;
  referenceType: string | null;
  referenceId: string | null;
  amount: number;
  description: string | null;
  createdBy: string;
  createdByEmail: string | null;
  createdAt: string;
};

export type CashSessionLastCount = {
  id: string;
  countedCashAmount: number;
  expectedAmount: number;
  differenceAmount: number;
  notes: string | null;
  countedByUserId: string;
  countedByUserEmail: string | null;
  countedAt: string;
} | null;

export type CashSessionSummary = {
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
  status: CashSessionStatus;
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
    expectedAmount: number;
    netAmount: number;
    movementCount: number;
    paymentCount: number;
  };
  paymentBreakdown: CashSessionPaymentBreakdown[];
  movementBreakdown: CashSessionMovementBreakdown[];
  recentMovements: CashSessionRecentMovement[];
  lastCount: CashSessionLastCount;
};

export type CashMovementType =
  | "OPENING"
  | "CLOSING"
  | "ADJUSTMENT"
  | "EXPENSE"
  | "WITHDRAWAL"
  | "PAYMENT";

export type CashMovementDirection = "IN" | "OUT";

export type CashMovement = {
  id: string;
  tenantId: string;
  branchId: string;
  cashSessionId: string;
  cashRegisterId: string | null;
  cashRegisterNombre: string | null;
  movementType: CashMovementType;
  direction: CashMovementDirection;
  referenceType: string | null;
  referenceId: string | null;
  amount: number;
  description: string | null;
  createdBy: string;
  createdByEmail: string | null;
  createdAt: string;
};

export type PaymentAllocation = {
  id: string;
  paymentId: string;
  referenceType: PaymentReferenceType;
  referenceId: string;
  allocatedAmount: number;
  createdAt: string;
};

export type Payment = {
  id: string;
  tenantId: string;
  branchId: string;
  paymentMethodId: string;
  paymentMethodCodigo: string | null;
  paymentMethodNombre: string | null;
  paymentMethodTipo: PaymentMethodType | null;
  cashSessionId: string | null;
  cashRegisterId: string | null;
  cashRegisterNombre: string | null;
  referenceType: PaymentReferenceType;
  referenceId: string;
  direction: PaymentDirection;
  status: PaymentStatus;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  referenceNumber: string | null;
  notes: string | null;
  paidByPersonId: string | null;
  paidByPersonName: string | null;
  createdBy: string;
  createdByEmail: string | null;
  createdAt: string;
  allocations: PaymentAllocation[];
};

export type PaymentMethodFilters = {
  tenantId?: string;
  active?: boolean;
};

export type CashRegisterFilters = {
  tenantId?: string;
  branchId?: string;
  activo?: boolean;
};

export type CashSessionHistoryFilters = {
  tenantId?: string;
  branchId?: string;
  cashRegisterId?: string;
  status?: CashSessionStatus;
  limit?: number;
  offset?: number;
};

export type CashMovementFilters = {
  tenantId?: string;
  branchId?: string;
  cashRegisterId?: string;
  cashSessionId?: string;
  movementType?: CashMovementType;
  direction?: CashMovementDirection;
  limit?: number;
  offset?: number;
};

export type PaymentFilters = {
  tenantId?: string;
  branchId?: string;
  paymentMethodId?: string;
  cashSessionId?: string;
  referenceType?: PaymentReferenceType;
  referenceId?: string;
  direction?: PaymentDirection;
  status?: PaymentStatus;
  limit?: number;
  offset?: number;
};

export type CreatePaymentMethodPayload = {
  tenantId?: string;
  codigo: string;
  nombre: string;
  tipo: PaymentMethodType;
  requiresReference?: boolean;
  allowsChange?: boolean;
  active?: boolean;
};

export type UpdatePaymentMethodPayload = Partial<CreatePaymentMethodPayload>;

export type CreateCashRegisterPayload = {
  tenantId?: string;
  branchId: string;
  terminalId?: string;
  codigo: string;
  nombre: string;
  activo?: boolean;
};

export type UpdateCashRegisterPayload = {
  branchId?: string;
  terminalId?: string | null;
  codigo?: string;
  nombre?: string;
  activo?: boolean;
};

export type OpenCashSessionPayload = {
  tenantId?: string;
  branchId: string;
  cashRegisterId: string;
  openingAmount: number;
};

export type CloseCashSessionPayload = {
  closingAmount: number;
  description?: string;
};

export type CreateCashMovementPayload = {
  tenantId?: string;
  cashSessionId: string;
  movementType: CashMovementType;
  direction: CashMovementDirection;
  amount: number;
  description?: string;
  referenceType?: string;
  referenceId?: string;
};

export type CreatePaymentAllocationPayload = {
  referenceType: PaymentReferenceType;
  referenceId: string;
  allocatedAmount: number;
};

export type CreatePaymentPayload = {
  tenantId?: string;
  branchId: string;
  paymentMethodId: string;
  cashSessionId?: string;
  referenceType: PaymentReferenceType;
  referenceId: string;
  direction: PaymentDirection;
  status?: PaymentStatus;
  amount: number;
  referenceNumber?: string;
  notes?: string;
  paidByPersonId?: string;
  allowOverpayment?: boolean;
  allocations?: CreatePaymentAllocationPayload[];
};
