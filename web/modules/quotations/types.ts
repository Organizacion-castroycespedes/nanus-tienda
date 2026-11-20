export type QuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CONVERTED";
export type QuotationEffectiveStatus = QuotationStatus | "EXPIRED";

export type QuotationHeader = {
  id: string;
  tenantId: string;
  code: string;
  status: QuotationStatus;
  effectiveStatus: QuotationEffectiveStatus;
  branchId: string;
  branchName: string | null;
  customerId: string;
  customerName: string | null;
  customerDocument: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  issueDate: string;
  validityDays: number;
  validUntil: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  commercialTerms: string | null;
  paymentDeliveryTerms: string | null;
  warrantyTerms: string | null;
  notes: string | null;
  pricingCalculatedAt: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  convertedOrderId: string | null;
  convertedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type QuotationItem = {
  id: string;
  lineNumber: number;
  productId: string;
  productName: string;
  productCode: string | null;
  unitCode: string | null;
  quantity: number;
  baseUnitPrice: number;
  finalUnitPrice: number;
  discountAmount: number;
  discountPercent: number;
  discountTotal: number;
  appliedPromotionId: string | null;
  appliedPromotionName: string | null;
  taxId: string | null;
  taxRate: number;
  taxBase: number;
  taxAmount: number;
  lineTotal: number;
};

export type QuotationTaxSummary = {
  taxName: string;
  taxRate: number;
  taxBase: number;
  taxAmount: number;
};

export type QuotationDetail = QuotationHeader & {
  items: QuotationItem[];
  taxSummary: QuotationTaxSummary[];
  order: { id: string; status: string; total: number; createdAt: string | null } | null;
};

export type QuotationListResponse = {
  data: QuotationHeader[];
  meta: { page: number; limit: number; total: number; lastPage: number };
  summary: { total: number; approved: number; expired: number; amount: number };
};

export type QuotationListFilters = {
  search?: string;
  status?: QuotationEffectiveStatus | "";
  branchId?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
};

export type QuotationLinePayload = { productId: string; quantity: number };

export type QuotationPayload = {
  customerId: string;
  branchId?: string;
  items: QuotationLinePayload[];
  commercialTerms?: string | null;
  paymentDeliveryTerms?: string | null;
  warrantyTerms?: string | null;
  notes?: string | null;
};

export type QuotationTextBlocksValue = {
  commercialTerms: string;
  paymentDeliveryTerms: string;
  warrantyTerms: string;
};

export type ConvertQuotationResponse = {
  quotation: QuotationDetail;
  order: { id: string; status: string; total: number; type: "CASH" | "CREDIT" };
};

export const QUOTATION_ACTIONS = {
  VIEW: "QUOTATIONS_VIEW",
  CREATE: "QUOTATIONS_CREATE",
  UPDATE: "QUOTATIONS_UPDATE",
  APPROVE: "QUOTATIONS_APPROVE",
  CONVERT: "QUOTATIONS_CONVERT",
  SETTINGS: "QUOTATIONS_SETTINGS",
} as const;

export type QuotationAction = (typeof QUOTATION_ACTIONS)[keyof typeof QUOTATION_ACTIONS];

export const QUOTATION_STATUS_LABELS: Record<QuotationEffectiveStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  CONVERTED: "Convertida",
  EXPIRED: "Vencida",
};

export const QUOTATION_STATUS_OPTIONS: Array<{ value: QuotationEffectiveStatus | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "SENT", label: "Enviada" },
  { value: "APPROVED", label: "Aprobada" },
  { value: "EXPIRED", label: "Vencida" },
  { value: "REJECTED", label: "Rechazada" },
  { value: "CONVERTED", label: "Convertida" },
];
