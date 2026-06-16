export type ReportingRole = "SUPER_ADMIN" | "SUPER_USER" | "ADMIN" | "USER" | string;

export type ReportFilters = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  customerDocument?: string;
  customerName?: string;
  status?: string;
};

export type CurrentShiftFilters = {
  tenantId?: string;
  branchId?: string;
  cashSessionId?: string;
  tab?: "sales" | "orders" | "purchases" | "movements" | "cash-count" | "tickets";
  page?: number;
  pageSize?: number;
  search?: string;
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
    customerDocument: string | null;
    customerName: string | null;
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
  totalPedido?: number;
  totalLiquidado?: number;
  diferenciaNoRecibida?: number;
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
    status?: string | null;
    actorRole: string;
  };
  summary: {
    count: number;
    activeCount?: number;
    cancelled?: number;
    total: number;
    totalNoRecibido?: number;
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

export type CurrentShiftCashSession = {
  id: string;
  tenantId: string;
  branchId: string;
  branchName: string | null;
  cashRegisterId: string;
  cashRegisterName: string | null;
  cashRegisterCode: string | null;
  terminalId: string | null;
  terminalName: string | null;
  userId: string;
  userName: string | null;
  openedAt: string;
  openingAmount: number;
  status: string;
};

export type CurrentShiftSummary = {
  openingAmount: number;
  posSalesTotal: number;
  orderSalesTotal: number;
  purchasesTotal: number;
  cashInTotal: number;
  cashOutTotal: number;
  expectedAmount: number;
  currentCountAmount: number | null;
  difference: number | null;
};

export type CurrentShiftSaleRow = {
  id: string;
  createdAt: string;
  customerName: string | null;
  paymentMethod: string | null;
  status: string;
  total: number;
  paidAmount: number;
  ticketAvailable: boolean;
};

export type CurrentShiftOrderRow = {
  id: string;
  createdAt: string;
  orderNumber: string | null;
  customerName: string | null;
  status: string;
  total: number;
  paidAmount: number;
  ticketAvailable: boolean;
};

export type CurrentShiftPurchaseRow = {
  id: string;
  createdAt: string;
  supplierName: string | null;
  status: string;
  total: number;
  paidAmount: number;
  ticketAvailable: boolean;
};

export type CurrentShiftMovementRow = {
  id: string;
  createdAt: string;
  type: string;
  description: string | null;
  amount: number;
  direction: string;
  referenceType: string | null;
  referenceId: string | null;
};

export type CurrentShiftCashCountRow = {
  id: string;
  createdAt: string;
  expectedAmount: number;
  countedAmount: number;
  difference: number;
  notes: string | null;
  ticketAvailable: boolean;
};

export type CurrentShiftTicketType =
  | "POS_SALE"
  | "ORDER"
  | "PURCHASE"
  | "CASH_COUNT"
  | "CASH_CLOSING";

export type CurrentShiftTicketRow = {
  type: CurrentShiftTicketType;
  entityId: string;
  label: string;
  createdAt: string;
  viewUrl: string;
  downloadUrl: string;
  printable: boolean;
};

export type CurrentShiftTab<T> = {
  total: number;
  rows: T[];
};

export type CurrentShiftResponse = {
  hasOpenCashSession: boolean;
  message: string | null;
  cashSession?: CurrentShiftCashSession;
  summary?: CurrentShiftSummary;
  filters: {
    tenantId: string;
    branchId: string | null;
    cashSessionId: string | null;
    actorRole: string;
    page: number;
    pageSize: number;
    search: string | null;
  };
  tabs: {
    sales: CurrentShiftTab<CurrentShiftSaleRow>;
    orders: CurrentShiftTab<CurrentShiftOrderRow>;
    purchases: CurrentShiftTab<CurrentShiftPurchaseRow>;
    movements: CurrentShiftTab<CurrentShiftMovementRow>;
    cashCount: CurrentShiftTab<CurrentShiftCashCountRow>;
    tickets: CurrentShiftTab<CurrentShiftTicketRow>;
  };
};

export type SelectorOption = {
  value: string;
  label: string;
};
