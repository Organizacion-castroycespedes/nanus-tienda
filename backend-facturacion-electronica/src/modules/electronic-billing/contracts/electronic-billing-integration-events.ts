import type { ElectronicCustomer } from "./electronic-billing-commands";

export const SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE =
  "SALE_COMPLETED_FOR_ELECTRONIC_BILLING" as const;

export type DecimalWireValue = string;

export type SaleCompletedForElectronicBillingEventEnvelope = {
  eventId: string;
  eventType: typeof SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE;
  schemaVersion: 1;
  tenantId: string;
  correlationId: string;
  occurredAt: string;
  source: {
    type: "SALE";
    id: string;
  };
  payload: SaleCompletedForElectronicBillingEventPayload;
};

export type SaleCompletedForElectronicBillingEventPayload = {
  sale: SaleSnapshot;
  customer: ElectronicCustomer;
  lines: SaleLineSnapshot[];
  taxes: SaleTaxSnapshot[];
  payments: SalePaymentSnapshot[];
  totals: SaleTotalsSnapshot;
  currencyCode: string;
  metadata?: Record<string, unknown>;
};

export type SaleSnapshot = {
  saleId: string;
  saleNumber?: string | null;
  saleType?: string | null;
  saleStatus?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  posSessionId?: string | null;
  orderId?: string | null;
  completedAt?: string | null;
  currencyCode?: string | null;
};

export type SaleLineTaxSnapshot = {
  type: string;
  code?: string | null;
  schemeId?: string | null;
  schemeName?: string | null;
  rate: DecimalWireValue;
  taxableBase: DecimalWireValue;
  amount: DecimalWireValue;
  metadata?: Record<string, unknown>;
};

export type SaleLineSnapshot = {
  sourceLineId: string;
  productId?: string | null;
  sku?: string | null;
  description: string;
  quantity: DecimalWireValue;
  unitCode?: string | null;
  unitPrice: DecimalWireValue;
  discountAmount?: DecimalWireValue | null;
  subtotalAmount: DecimalWireValue;
  taxAmount: DecimalWireValue;
  totalAmount: DecimalWireValue;
  taxTreatment?: string | null;
  standardItemId?: string | null;
  standardItemSchemeId?: string | null;
  taxes: SaleLineTaxSnapshot[];
  metadata?: Record<string, unknown>;
};

export type SaleTaxSnapshot = SaleLineTaxSnapshot & {
  sourceLineId?: string | null;
};

export type SalePaymentSnapshot = {
  methodCode: string;
  amount?: DecimalWireValue | null;
  term?: string | null;
  dueDate?: string | null;
  reference?: string | null;
  metadata?: Record<string, unknown>;
};

export type SaleTotalsSnapshot = {
  subtotalAmount: DecimalWireValue;
  discountAmount: DecimalWireValue;
  taxAmount: DecimalWireValue;
  totalAmount: DecimalWireValue;
};
