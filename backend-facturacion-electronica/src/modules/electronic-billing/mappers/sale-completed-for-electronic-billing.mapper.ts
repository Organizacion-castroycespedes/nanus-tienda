import type {
  ElectronicCustomer,
  ElectronicBillingProviderContext,
  ElectronicDocumentLineInput,
  ElectronicDocumentTotals,
  ElectronicPayment,
  IssueElectronicInvoiceCommand,
} from "../contracts/electronic-billing-commands";
import {
  SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE,
  type DecimalWireValue,
  type SaleCompletedForElectronicBillingEventEnvelope,
  type SaleLineSnapshot,
  type SalePaymentSnapshot,
} from "../contracts/electronic-billing-integration-events";

const toDecimalWireValue = (value: DecimalWireValue | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "0";
  }

  return typeof value === "number" ? String(value) : value;
};

export const buildDeterministicSaleExternalReference = (
  tenantId: string,
  saleId: string,
) => `SALE-${tenantId}-${saleId}`;

export const buildElectronicBillingCustomer = (
  customer: ElectronicCustomer,
): ElectronicCustomer => customer;

export const buildElectronicBillingPayment = (
  payments: SalePaymentSnapshot[],
): ElectronicPayment | null => {
  if (payments.length !== 1) {
    return null;
  }

  const [primaryPayment] = payments;
  return {
    methodCode: primaryPayment.methodCode,
    term: primaryPayment.term ?? null,
    dueDate: primaryPayment.dueDate ?? null,
    metadata: {
      amount: primaryPayment.amount ?? null,
      reference: primaryPayment.reference ?? null,
      paymentBreakdown: payments,
    },
  };
};

const mapTaxes = (line: SaleLineSnapshot) =>
  line.taxes.map((tax) => ({
    type: tax.type,
    code: tax.code ?? null,
    schemeId: tax.schemeId ?? null,
    schemeName: tax.schemeName ?? null,
    rate: toDecimalWireValue(tax.rate),
    taxableBase: toDecimalWireValue(tax.taxableBase),
    amount: toDecimalWireValue(tax.amount),
    metadata: tax.metadata ?? {},
  }));

export const buildElectronicBillingInvoiceCommandFromSaleEvent = (
  event: SaleCompletedForElectronicBillingEventEnvelope,
  context: ElectronicBillingProviderContext,
  documentId: string,
): IssueElectronicInvoiceCommand => {
  const externalReference = buildDeterministicSaleExternalReference(
    event.tenantId,
    event.source.id,
  );
  const payment = buildElectronicBillingPayment(event.payload.payments);
  const lines: ElectronicDocumentLineInput[] = event.payload.lines.map((line) => ({
    sourceLineId: line.sourceLineId,
    sku: line.sku ?? null,
    description: line.description,
    quantity: toDecimalWireValue(line.quantity),
    unitCode: line.unitCode ?? null,
    unitPrice: toDecimalWireValue(line.unitPrice),
    discountAmount: line.discountAmount ?? null,
    subtotalAmount: toDecimalWireValue(line.subtotalAmount),
    taxAmount: toDecimalWireValue(line.taxAmount),
    totalAmount: toDecimalWireValue(line.totalAmount),
    taxTreatment: line.taxTreatment ?? null,
    standardItemId: line.standardItemId ?? null,
    standardItemSchemeId: line.standardItemSchemeId ?? null,
    taxes: mapTaxes(line),
    metadata: {
      ...(line.metadata ?? {}),
      saleLine: {
        sourceLineId: line.sourceLineId,
        productId: line.productId ?? null,
      },
    },
  }));

  const totals: ElectronicDocumentTotals = {
    subtotalAmount: toDecimalWireValue(event.payload.totals.subtotalAmount),
    discountAmount: toDecimalWireValue(event.payload.totals.discountAmount),
    taxAmount: toDecimalWireValue(event.payload.totals.taxAmount),
    totalAmount: toDecimalWireValue(event.payload.totals.totalAmount),
    currencyCode: event.payload.currencyCode,
  };

  return {
    context,
    documentId,
    externalReference,
    issueDate: event.payload.sale.completedAt ?? null,
    issueTime: null,
    customer: buildElectronicBillingCustomer(event.payload.customer),
    payment,
    lines,
    totals,
    metadata: {
      ...(event.payload.metadata ?? {}),
      integrationEvent: {
        eventId: event.eventId,
        eventType: event.eventType,
        schemaVersion: event.schemaVersion,
        correlationId: event.correlationId,
        occurredAt: event.occurredAt,
        source: event.source,
      },
      sale: event.payload.sale,
      payments: event.payload.payments,
      taxes: event.payload.taxes,
      eventType: SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE,
    },
  };
};

export const isSaleCompletedForElectronicBillingEvent = (
  value: unknown,
): value is SaleCompletedForElectronicBillingEventEnvelope => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as SaleCompletedForElectronicBillingEventEnvelope;
  return (
    event.eventType === SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE &&
    event.schemaVersion === 1 &&
    event.source?.type === "SALE" &&
    typeof event.eventId === "string" &&
    typeof event.tenantId === "string" &&
    typeof event.correlationId === "string" &&
    typeof event.occurredAt === "string" &&
    typeof event.source.id === "string" &&
    Boolean(event.payload)
  );
};
