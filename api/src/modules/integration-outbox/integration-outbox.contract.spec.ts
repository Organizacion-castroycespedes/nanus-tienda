import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildSaleCompletedForElectronicBillingEvent } from "./mappers/sale-completed-for-electronic-billing.builder";
import { SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE } from "./contracts/integration-outbox-events";

test("sale completed outbox event matches billing consumer contract", () => {
  const event = buildSaleCompletedForElectronicBillingEvent({
    eventId: randomUUID(),
    tenantId: randomUUID(),
    correlationId: randomUUID(),
    occurredAt: "2026-08-28T12:00:00.000Z",
    sale: {
      saleId: randomUUID(),
      saleNumber: "S-0001",
      saleType: "CASH",
      saleStatus: "COMPLETED",
      branchId: randomUUID(),
      terminalId: randomUUID(),
      posSessionId: randomUUID(),
      orderId: randomUUID(),
      completedAt: "2026-08-28T12:00:00.000Z",
      currencyCode: "COP",
    },
    customer: {
      customerId: randomUUID(),
      customerType: "NATURAL",
      identificationType: "CC",
      identificationTypeCode: "CC",
      identificationNumber: "123456789",
      verificationDigit: "5",
      legalName: "Juan Perez",
      email: "juan@example.com",
      phone: "3001234567",
      addressLine1: "Calle 1 # 2-3",
      countryCode: "CO",
      departmentCode: "11",
      municipalityCode: "11001",
      cityName: "Bogota",
      departmentName: "Bogota",
      countryName: "Colombia",
      taxLevelCode: "O-13",
      taxSchemeId: "ZZ",
      taxSchemeName: "No aplica",
      fiscalResponsibilityCodes: ["R-99-PN"],
      metadata: {
        consumerFinal: false,
      },
    },
    lines: [
      {
        sourceLineId: randomUUID(),
        productId: randomUUID(),
        sku: "SKU-1",
        description: "Product 1",
        quantity: "2.00",
        unitCode: "EA",
        unitPrice: "100.00",
        discountAmount: "10.00",
        subtotalAmount: "190.00",
        taxAmount: "36.10",
        totalAmount: "226.10",
        taxTreatment: "TAXED",
        standardItemId: "1001",
        standardItemSchemeId: "999",
        taxes: [
          {
            type: "VAT",
            code: "01",
            schemeId: "01",
            schemeName: "IVA",
            rate: "19.00",
            taxableBase: "190.00",
            amount: "36.10",
          },
        ],
      },
    ],
    taxes: [
      {
        type: "VAT",
        sourceLineId: randomUUID(),
        code: "01",
        schemeId: "01",
        schemeName: "IVA",
        rate: "19.00",
        taxableBase: "190.00",
        amount: "36.10",
      },
    ],
    payments: [
      {
        methodCode: "10",
        amount: "226.10",
        term: "CONTADO",
        reference: "cash",
      },
      {
        methodCode: "48",
        amount: "10.00",
        term: "MIXED",
        reference: "card",
      },
    ],
    totals: {
      subtotalAmount: "190.00",
      discountAmount: "10.00",
      taxAmount: "36.10",
      totalAmount: "226.10",
    },
    currencyCode: "COP",
    metadata: {
      source: "sale-service",
      mixedPayment: true,
    },
  });

  assert.equal(event.eventType, SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE);
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.source.type, "SALE");
  assert.equal(event.payload.sale.saleStatus, "COMPLETED");
  assert.equal(event.payload.lines[0]?.sourceLineId.length > 0, true);
  assert.equal(event.payload.payments.length, 2);
  assert.equal(event.payload.payments[1]?.methodCode, "48");
  assert.equal(event.payload.totals.totalAmount, "226.10");
  assert.equal(event.payload.currencyCode, "COP");
  assert.equal(event.payload.metadata?.mixedPayment, true);
});
