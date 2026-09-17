export type ReportActorContext = {
  userId: string;
  role: string;
  tenantId: string;
  branchId: string | null;
  email?: string | null;
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
  billingStatus:
    | "NO_DOCUMENT"
    | "ELIGIBLE_ON_DEMAND"
    | "REQUESTED"
    | "PENDING"
    | "PROCESSING"
    | "ACCEPTED"
    | "REJECTED"
    | "TECHNICAL_ERROR"
    | "CANCELLED"
    | "AMBIGUOUS";
  billingDocumentNumber: string | null;
  billingCufe: string | null;
  billingAcceptedAt: string | null;
};

export type PosSalesListSummary = {
  count: number;
  total: number;
  paid: number;
  balance: number;
  cancelled: number;
  refunded: number;
};

export type PosSalesListDataset = {
  filters: {
    tenantId: string;
    branchId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    actorRole: string;
  };
  summary: PosSalesListSummary;
  rows: PosSalesListRow[];
};

export type PosSaleTicketItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type PosSaleTicketPayment = {
  paymentId: string;
  method: string;
  amount: number;
  status: string;
  direction: string;
  referenceType: string;
  referenceNumber?: string | null;
  notes?: string | null;
};

export type PosSaleTicketPaymentBreakdown = {
  method: string;
  amount: number;
};

export type PosSaleTicketTaxBreakdown = {
  label: string;
  dianCode: string;
  taxTypeCode: string;
  taxBase: number;
  taxAmount: number;
};

export type PosSaleTicketDataset = {
  header: {
    saleId: string;
    date: string;
    tenantName: string | null;
    branch: string | null;
    branchId: string;
    terminal: string | null;
    terminalId: string;
    cashier: string;
    cashierId: string;
    customer: string;
    customerId: string | null;
    status: string;
    paymentStatus: string;
  };
  items: PosSaleTicketItem[];
  payments: PosSaleTicketPayment[];
  paymentBreakdown: PosSaleTicketPaymentBreakdown[];
  totals: {
    subtotal: number;
    taxes: number;
    taxBreakdown?: PosSaleTicketTaxBreakdown[];
    total: number;
    paid: number;
    change: number;
    balance: number;
  };
  cashContext?: {
    cashSession: string | null;
    cashRegister: string | null;
    openedAt: string | null;
  } | null;
};

export type PrintableCompanyHeader = {
  legalName: string | null;
  nit: string | null;
  dv: string | null;
  taxResponsibilities: string | null;
  regime: string | null;
  vatResponsibility: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo: string | null;
  branchName: string | null;
  branchAddress: string | null;
  branchCity: string | null;
  branchDepartment: string | null;
  branchCountry: string | null;
  branchPhone: string | null;
  branchEmail: string | null;
};

export type PosSaleTicketPrintDataset = {
  tenantId: string;
  company: PrintableCompanyHeader;
  ticket: PosSaleTicketDataset;
};

export type PosSaleCancelTicketDataset = {
  header: {
    saleId: string;
    originalDate: string;
    cancelledAt: string | null;
    tenantName: string | null;
    branch: string | null;
    branchId: string;
    terminal: string | null;
    terminalId: string;
    cashier: string;
    cashierId: string;
    customer: string;
    customerId: string | null;
    status: string;
    paymentStatus: string;
  };
  cancellation: {
    originalSaleId: string;
    reason: string | null;
    finalStatus: string;
  };
  paymentsReverted: Array<{
    paymentId: string;
    method: string;
    amount: number;
    status: string;
    referenceNumber?: string | null;
    notes?: string | null;
    date: string;
  }>;
  cashMovements: Array<{
    movementId: string;
    cashSessionId: string | null;
    cashRegister?: string | null;
    amount: number;
    description?: string | null;
    date: string;
  }>;
  totals: {
    saleTotal: number;
    paid: number;
    balance: number;
    refunded: number;
  };
};
