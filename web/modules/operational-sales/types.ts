export const SALE_STATUSES = ["DRAFT", "CONFIRMED", "CANCELLED", "REFUNDED"] as const;
export const PAYMENT_STATUSES = ["PENDING", "PAID", "PARTIAL", "CANCELLED"] as const;
export const ELECTRONIC_BILLING_STATUSES = [
  "PENDING",
  "PROCESSING",
  "ACCEPTED",
  "REJECTED",
  "TECHNICAL_ERROR",
  "CANCELLED",
] as const;

export type OperationalSaleListItem = {
  id: string;
  createdAt: string;
  status: string;
  saleType: string;
  paymentStatus: string;
  total: number;
  customer: { id: string; name: string | null };
  branch: { id: string; name: string | null };
  operator: { id: string | null; email: string | null };
  cashSessionId: string | null;
  electronicBilling: {
    status: string;
    electronicDocumentId: string | null;
    documentNumber: string | null;
    cufe: string | null;
    providerDocumentId: string | null;
    providerStatus: string | null;
  } | null;
};

export type OperationalSalesResponse = {
  items: OperationalSaleListItem[];
  page: number;
  limit: number;
  total: number;
  sortBy: "createdAt" | "total" | "status";
  sortDirection: "ASC" | "DESC";
};

export type OperationalSaleDetail = OperationalSaleListItem & {
  balance: number;
  totalPaid: number | null;
  balanceDue: number | null;
  terminalId: string | null;
  posSessionId: string | null;
  electronicBilling: (NonNullable<OperationalSaleListItem["electronicBilling"]> & {
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    documentCount: number;
    retryability?: {
      canRetry: boolean;
      canRecoverProviderCreateIntent: boolean;
      canRecoverExistingProvider?: boolean;
      retryClass: string;
      decision: string;
      reasonCode: string;
      requiredAction: string;
      requiresReconciliation: boolean;
      providerDocumentExists: boolean;
      processingStage: string;
      safeUserMessage: string;
    };
  }) | null;
  retryResult?: {
    allowed: boolean;
    canRetry: boolean;
    disposition: string;
    reasonCode: string;
    requiredAction: string;
    status: string | null;
    processingStage: string | null;
    safeUserMessage: string;
  };
  recoveryResult?: {
    allowed: boolean;
    recovery: "CONFIRMED_PROVIDER_ABSENCE" | "EXISTING_PROVIDER_RESUMED";
    resultCode: "REMOTE_FOUND_RECONCILED" | "REMOTE_NOT_FOUND_RECOVERED" | "EXISTING_PROVIDER_RECONCILED";
    status: string | null;
    processingStage: string | null;
    safeUserMessage: string;
  };
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    taxTotal: number;
    total: number;
  }>;
  payments: Array<{
    id: string;
    paymentMethod: string | null;
    amount: number;
    cashSessionId: string | null;
    status: string;
    createdAt: string;
  }>;
};

export type OperationalSalesFilters = {
  dateFrom: string;
  dateTo: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  branchId: string;
  userId: string;
  cashSessionId: string;
  customerId: string;
  documentNumber: string;
  electronicBillingStatus: string;
};

export const emptyOperationalSalesFilters: OperationalSalesFilters = {
  dateFrom: "",
  dateTo: "",
  status: "",
  paymentStatus: "",
  paymentMethod: "",
  branchId: "",
  userId: "",
  cashSessionId: "",
  customerId: "",
  documentNumber: "",
  electronicBillingStatus: "",
};
