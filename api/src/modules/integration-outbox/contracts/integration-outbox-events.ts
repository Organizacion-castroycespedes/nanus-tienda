export const SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE =
  "SALE_COMPLETED_FOR_ELECTRONIC_BILLING" as const;

export type IntegrationOutboxDecimalWireValue = string;

export type IntegrationOutboxSource = {
  type: "SALE";
  id: string;
};

export type SaleCompletedForElectronicBillingEventEnvelope = {
  eventId: string;
  eventType: typeof SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE;
  schemaVersion: 1;
  tenantId: string;
  correlationId: string;
  occurredAt: string;
  source: IntegrationOutboxSource;
  payload: SaleCompletedForElectronicBillingEventPayload;
};

export type SaleCompletedForElectronicBillingEventPayload = {
  sale: SaleSnapshot;
  customer: SaleCustomerSnapshot;
  lines: SaleLineSnapshot[];
  taxes: SaleTaxSnapshot[];
  payments: SalePaymentSnapshot[];
  totals: SaleTotalsSnapshot;
  currencyCode: string;
  issuerVatResponsibility?: "RESPONSIBLE" | "NOT_RESPONSIBLE" | "UNKNOWN";
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

export type SaleCustomerSnapshot = {
  customerId?: string | null;
  customerType?: string | null;
  identificationType?: string | null;
  identificationTypeCode?: string | null;
  identificationNumber?: string | null;
  verificationDigit?: string | null;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  countryCode?: string | null;
  departmentCode?: string | null;
  municipalityCode?: string | null;
  cityName?: string | null;
  departmentName?: string | null;
  countryName?: string | null;
  taxLevelCode?: string | null;
  taxSchemeId?: string | null;
  taxSchemeName?: string | null;
  fiscalResponsibilityCodes?: string[] | null;
  metadata?: Record<string, unknown>;
};

export type SaleLineTaxSnapshot = {
  type: string;
  code?: string | null;
  schemeId?: string | null;
  schemeName?: string | null;
  rate: IntegrationOutboxDecimalWireValue;
  taxableBase: IntegrationOutboxDecimalWireValue;
  amount: IntegrationOutboxDecimalWireValue;
  metadata?: Record<string, unknown>;
};

export type SaleLineSnapshot = {
  sourceLineId: string;
  productId?: string | null;
  sku?: string | null;
  description: string;
  quantity: IntegrationOutboxDecimalWireValue;
  unitCode?: string | null;
  unitPrice: IntegrationOutboxDecimalWireValue;
  discountAmount?: IntegrationOutboxDecimalWireValue | null;
  subtotalAmount: IntegrationOutboxDecimalWireValue;
  taxAmount: IntegrationOutboxDecimalWireValue;
  totalAmount: IntegrationOutboxDecimalWireValue;
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
  amount?: IntegrationOutboxDecimalWireValue | null;
  term?: string | null;
  dueDate?: string | null;
  reference?: string | null;
  metadata?: Record<string, unknown>;
};

export type SaleTotalsSnapshot = {
  subtotalAmount: IntegrationOutboxDecimalWireValue;
  discountAmount: IntegrationOutboxDecimalWireValue;
  taxAmount: IntegrationOutboxDecimalWireValue;
  totalAmount: IntegrationOutboxDecimalWireValue;
};

export type BuildSaleCompletedForElectronicBillingEventInput = {
  eventId: string;
  tenantId: string;
  correlationId: string;
  occurredAt?: string | Date;
  sale: SaleSnapshot;
  customer: SaleCustomerSnapshot;
  lines: SaleLineSnapshot[];
  taxes: SaleTaxSnapshot[];
  payments: SalePaymentSnapshot[];
  totals: SaleTotalsSnapshot;
  currencyCode: string;
  issuerVatResponsibility?: "RESPONSIBLE" | "NOT_RESPONSIBLE" | "UNKNOWN";
  metadata?: Record<string, unknown>;
};
