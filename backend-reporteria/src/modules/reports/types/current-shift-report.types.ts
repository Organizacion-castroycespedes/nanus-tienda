export type CurrentShiftActorContext = {
  userId: string;
  role: string;
  tenantId: string;
  branchId: string | null;
  email?: string | null;
};

export type CurrentShiftQuery = {
  tenantId?: string;
  branchId?: string;
  cashSessionId?: string;
  tab?: "sales" | "orders" | "purchases" | "movements" | "cash-count" | "tickets";
  page?: string | number;
  pageSize?: string | number;
  search?: string;
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
  status: "OPEN" | "CLOSED" | "CANCELLED" | string;
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
  direction: "IN" | "OUT" | string;
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
