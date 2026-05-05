export type ReportingRole = "SUPER_ADMIN" | "SUPER_USER" | "ADMIN" | "USER" | string;

export type ReportFilters = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type PosSalesListRow = {
  saleId: string;
  date: string;
  status: string;
  customerName: string;
  total: number;
  paid: number;
  balance: number;
  paymentStatus: string;
  branchId: string;
  branchName?: string | null;
  cashSessionId: string | null;
};

export type PosSalesListDataset = {
  filters: {
    tenantId: string;
    branchId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    actorRole: string;
  };
  summary: {
    count: number;
    total: number;
    paid: number;
    balance: number;
    cancelled: number;
    refunded: number;
  };
  rows: PosSalesListRow[];
};

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

export type PurchasesListRow = {
  purchaseId: string;
  date: string;
  supplierName: string;
  total: number;
  paid: number;
  balance: number;
  paymentStatus: string;
  branchId: string | null;
  branchName: string | null;
  status: string;
};

export type PurchasesListDataset = {
  filters: {
    tenantId: string;
    branchId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    actorRole: string;
  };
  summary: {
    count: number;
    total: number;
    paid: number;
    balance: number;
  };
  rows: PurchasesListRow[];
};

export type OrderSalesListRow = {
  orderId: string;
  date: string;
  customerName: string;
  total: number;
  paid: number;
  balance: number;
  status: string;
  paymentStatus: string;
  branchId: string | null;
  branchName: string | null;
  generatedSaleId: string | null;
};

export type OrderSalesListDataset = {
  filters: {
    tenantId: string;
    branchId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    actorRole: string;
  };
  summary: {
    count: number;
    total: number;
    paid: number;
    balance: number;
    completed: number;
    partial: number;
    pending: number;
  };
  rows: OrderSalesListRow[];
};

export type CustomerOrdersStatusRow = {
  customerId: string;
  customerName: string;
  totalOrders: number;
  pendingOrders: number;
  partialOrders: number;
  completedOrders: number;
  totalAmount: number;
  totalPending: number;
};

export type CustomerOrdersStatusDataset = {
  filters: {
    tenantId: string;
    branchId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    actorRole: string;
  };
  summary: {
    count: number;
    totalOrders: number;
    pendingOrders: number;
    partialOrders: number;
    completedOrders: number;
    totalAmount: number;
    totalPending: number;
  };
  rows: CustomerOrdersStatusRow[];
};

export type SelectorOption = {
  value: string;
  label: string;
};
