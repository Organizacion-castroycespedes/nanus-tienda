import {
  SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE,
  type BuildSaleCompletedForElectronicBillingEventInput,
  type SaleCompletedForElectronicBillingEventEnvelope,
} from "../contracts/integration-outbox-events";

const normalizeDate = (value: string | Date | undefined) =>
  value instanceof Date ? value.toISOString() : value ?? new Date().toISOString();

export const buildSaleCompletedForElectronicBillingEvent = (
  input: BuildSaleCompletedForElectronicBillingEventInput,
): SaleCompletedForElectronicBillingEventEnvelope => ({
  eventId: input.eventId,
  eventType: SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE,
  schemaVersion: 1,
  tenantId: input.tenantId,
  correlationId: input.correlationId,
  occurredAt: normalizeDate(input.occurredAt),
  source: {
    type: "SALE",
    id: input.sale.saleId,
  },
  payload: {
    sale: input.sale,
    customer: input.customer,
    lines: input.lines,
    taxes: input.taxes,
    payments: input.payments,
    totals: input.totals,
    currencyCode: input.currencyCode,
    metadata: input.metadata,
  },
});
