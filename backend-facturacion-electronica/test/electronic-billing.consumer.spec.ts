import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  SaleCompletedForElectronicBillingConsumerService,
  validateSnapshotTotals,
} from "../src/modules/electronic-billing";
import {
  ElectronicBillingSaleEventTemporaryFailureError,
  ElectronicBillingSaleEventValidationError,
} from "../src/modules/electronic-billing/consumers";
import type { SaleCompletedForElectronicBillingEventEnvelope } from "../src/modules/electronic-billing/contracts/electronic-billing-integration-events";
import { ElectronicBillingSaleEventController } from "../src/modules/electronic-billing/consumers";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000701",
  provider: "00000000-0000-0000-0000-000000000702",
  config: "00000000-0000-0000-0000-000000000703",
};

const buildEnvelope = (
  overrides: Partial<SaleCompletedForElectronicBillingEventEnvelope> = {},
): SaleCompletedForElectronicBillingEventEnvelope => ({
  eventId: overrides.eventId ?? "event-1",
  eventType: "SALE_COMPLETED_FOR_ELECTRONIC_BILLING",
  schemaVersion: 1,
  tenantId: overrides.tenantId ?? ids.tenant,
  correlationId: overrides.correlationId ?? "corr-1",
  occurredAt: overrides.occurredAt ?? "2026-08-28T00:00:00.000Z",
  source: overrides.source ?? {
    type: "SALE",
    id: "sale-1",
  },
  payload:
    overrides.payload ?? {
      sale: {
        saleId: "sale-1",
        saleType: "CASH",
        saleStatus: "COMPLETED",
        currencyCode: "COP",
        completedAt: "2026-08-28T00:00:00.000Z",
      },
      customer: {
        identification: {
          typeCode: "31",
          number: "900123456",
        },
        legalName: "Client SA",
        email: "client@example.com",
        municipalityCode: "11001",
        metadata: {},
      },
      lines: [
        {
          sourceLineId: "line-1",
          description: "Product 1",
          quantity: "1",
          unitCode: "EA",
          unitPrice: "1000",
          subtotalAmount: "1000",
          taxAmount: "190",
          totalAmount: "1190",
          taxes: [
            {
              type: "IVA",
              code: "01",
              rate: "19",
              taxableBase: "1000",
              amount: "190",
            },
          ],
        },
      ],
      taxes: [
        {
          sourceLineId: "line-1",
          type: "IVA",
          code: "01",
          rate: "19",
          taxableBase: "1000",
          amount: "190",
        },
      ],
      payments: [
        {
          methodCode: "10",
          amount: "1190",
        },
      ],
      totals: {
        subtotalAmount: "1000",
        discountAmount: "0",
        taxAmount: "190",
        totalAmount: "1190",
      },
      currencyCode: "COP",
      metadata: {},
  },
});

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = canonicalize((value as Record<string, unknown>)[key]);
      return accumulator;
    }, {});
};

const buildHarness = (overrides: {
  existing?: any;
  inserted?: any;
  providerDisabled?: boolean;
  billingResult?: any;
} = {}) => {
  const records = new Map<string, any>();
  const sourceKey = (tenantId: string, sourceType: string, sourceId: string) =>
    `${tenantId}:${sourceType}:${sourceId}`;

  if (overrides.existing) {
    records.set(overrides.existing.event_id, overrides.existing);
    if (["RECEIVED", "PROCESSED"].includes(overrides.existing.status)) {
      records.set(sourceKey(overrides.existing.tenant_id, overrides.existing.source_type, overrides.existing.source_id), overrides.existing);
    }
  }

  const inboxRepository = {
    findByEventId: async (eventId: string) => records.get(eventId) ?? null,
    findBySource: async (tenantId: string, sourceType: string, sourceId: string) =>
      records.get(sourceKey(tenantId, sourceType, sourceId)) ?? null,
    insertReceived: async (input: any) => {
      if (records.has(input.eventId) || records.has(sourceKey(input.tenantId, input.sourceType, input.sourceId))) {
        return null;
      }
      const record = overrides.inserted ?? {
        id: input.id,
        event_id: input.eventId,
        event_type: input.eventType,
        schema_version: input.schemaVersion,
        tenant_id: input.tenantId,
        correlation_id: input.correlationId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        external_reference: input.externalReference,
        payload_hash: input.payloadHash,
        payload: input.payload,
        status: input.status ?? "RECEIVED",
        electronic_document_id: null,
        received_at: input.receivedAt,
        processed_at: null,
        last_error_code: null,
        last_error_message: null,
        created_at: input.createdAt,
        updated_at: input.updatedAt,
      };
      records.set(record.event_id, record);
      if (["RECEIVED", "PROCESSED"].includes(record.status)) {
        records.set(sourceKey(record.tenant_id, record.source_type, record.source_id), record);
      }
      return record;
    },
    markProcessed: async (eventId: string, input: any) => {
      const record = records.get(eventId);
      if (!record) {
        return null;
      }
      const updated = {
        ...record,
        status: "PROCESSED",
        electronic_document_id: input.electronicDocumentId,
        processed_at: input.processedAt,
        last_error_code: null,
        last_error_message: null,
      };
      records.set(eventId, updated);
      records.set(sourceKey(updated.tenant_id, updated.source_type, updated.source_id), updated);
      return updated;
    },
    markFailed: async (eventId: string, input: any) => {
      const record = records.get(eventId);
      if (!record) {
        return null;
      }
      const updated = {
        ...record,
        status: input.status ?? "FAILED",
        last_error_code: input.errorCode,
        last_error_message: input.errorMessage,
      };
      records.set(eventId, updated);
      records.delete(sourceKey(updated.tenant_id, updated.source_type, updated.source_id));
      return updated;
    },
  };

  const billingService = {
    calls: [] as any[],
    createInvoiceDocument: async (command: any, client: any, source: any) => {
      billingService.calls.push({ command, client, source });
      return overrides.billingResult ?? {
        document: {
          id: "document-1",
          external_reference: command.externalReference,
          status: "PENDING",
        },
        idempotent: false,
      };
    },
  };

  const providerResolver = {
    resolve: async () => {
      if (overrides.providerDisabled) {
        throw new Error("disabled");
      }

      return {
        provider: { code: "FAKE_PROVIDER" },
        context: {
          tenantId: ids.tenant,
          providerId: ids.provider,
          providerConfigId: ids.config,
          environment: "TEST",
          baseUrl: null,
          credentialReference: null,
          settings: {},
        },
        config: {
          configId: ids.config,
          tenantId: ids.tenant,
          providerId: ids.provider,
          providerCode: "FAKE_PROVIDER",
          providerName: "Fake",
          environment: "TEST",
          enabled: true,
          baseUrl: null,
          credentialReference: null,
          settings: {},
          isDefault: true,
        },
      };
    },
  };

  const db = {
    transaction: async (runner: (client: any) => Promise<any>) => runner({
      query: async () => ({ rows: [] }),
      release: () => undefined,
    }),
  };

  const consumer = new SaleCompletedForElectronicBillingConsumerService(
    db as never,
    inboxRepository as never,
    billingService as never,
    providerResolver as never,
  );

  return {
    consumer,
    billingService,
    records,
  };
};

test("consumer creates electronic document and marks inbox processed", async () => {
  const harness = buildHarness();

  const result = await harness.consumer.consume(buildEnvelope());

  assert.equal(result.status, "ACCEPTED");
  assert.equal(result.electronicDocumentId, "document-1");
  assert.equal(harness.billingService.calls.length, 1);
  assert.equal(harness.records.get("event-1")?.status, "PROCESSED");
});

test("consumer returns already processed result for duplicate event", async () => {
  const duplicateEnvelope = buildEnvelope();
  const existing = {
    id: "inbox-1",
    event_id: "event-1",
    event_type: "SALE_COMPLETED_FOR_ELECTRONIC_BILLING",
    schema_version: 1,
    tenant_id: ids.tenant,
    correlation_id: "corr-1",
    source_type: "SALE",
    source_id: "sale-1",
    external_reference: "SALE-tenant-sale",
    payload_hash: createHash("sha256").update(JSON.stringify(canonicalize(duplicateEnvelope.payload))).digest("hex"),
    payload: duplicateEnvelope.payload,
    status: "PROCESSED",
    electronic_document_id: "document-1",
    received_at: new Date("2026-08-28T00:00:00.000Z"),
    processed_at: new Date("2026-08-28T00:01:00.000Z"),
    last_error_code: null,
    last_error_message: null,
    created_at: new Date("2026-08-28T00:00:00.000Z"),
    updated_at: new Date("2026-08-28T00:01:00.000Z"),
  };
  const harness = buildHarness({ existing });

  const result = await harness.consumer.consume(duplicateEnvelope);

  assert.equal(result.status, "ALREADY_PROCESSED");
  assert.equal(result.electronicDocumentId, "document-1");
  assert.equal(harness.billingService.calls.length, 0);
});

test("consumer rejects bad totals as invalid event", async () => {
  const harness = buildHarness();
  const envelope = buildEnvelope({
    payload: {
      ...buildEnvelope().payload,
      totals: {
        subtotalAmount: "1000",
        discountAmount: "0",
        taxAmount: "190",
        totalAmount: "1200",
      },
    },
  });

  const result = await harness.consumer.consume(envelope);

  assert.equal(result.status, "INVALID_EVENT");
  assert.equal(result.retryable, false);
  assert.equal(harness.billingService.calls.length, 0);
  assert.equal(harness.records.get("event-1")?.status, "FAILED");
});

test("snapshot totals do not subtract line discounts twice", () => {
  assert.doesNotThrow(() =>
    validateSnapshotTotals(
      [
        {
          sourceLineId: "line-1",
          description: "Discounted product",
          quantity: "2.5",
          unitPrice: "100.00",
          discountAmount: "25.00",
          subtotalAmount: "225.00",
          taxAmount: "42.75",
          totalAmount: "267.75",
          taxes: [],
        },
      ],
      {
        subtotalAmount: "225.00",
        discountAmount: "25.00",
        taxAmount: "42.75",
        totalAmount: "267.75",
      },
    ),
  );
});

test("snapshot totals reconcile mixed discounts, multi-rate taxes and fractional rounding", () => {
  assert.doesNotThrow(() =>
    validateSnapshotTotals(
      [
        {
          sourceLineId: "line-1",
          description: "IVA 19",
          quantity: "1",
          unitPrice: "100.00",
          discountAmount: "10.00",
          subtotalAmount: "90.00",
          taxAmount: "17.10",
          totalAmount: "107.10",
          taxes: [],
        },
        {
          sourceLineId: "line-2",
          description: "IVA 5",
          quantity: "3",
          unitPrice: "33.3333",
          discountAmount: "0",
          subtotalAmount: "99.9999",
          taxAmount: "5.00",
          totalAmount: "104.9999",
          taxes: [],
        },
      ],
      {
        subtotalAmount: "189.9999",
        discountAmount: "10.00",
        taxAmount: "22.10",
        totalAmount: "212.0999",
      },
    ),
  );
});

test("reconciles the reproduced target sale snapshot without double discount", () => {
  assert.doesNotThrow(() =>
    validateSnapshotTotals(
      [
        {
          sourceLineId: "target-line-1",
          description: "Target line 1",
          quantity: "1",
          unitPrice: "52941.18",
          discountAmount: "0",
          subtotalAmount: "52941.18",
          taxAmount: "10058.82",
          totalAmount: "63000.00",
          taxes: [],
        },
        {
          sourceLineId: "target-line-2",
          description: "Target line 2",
          quantity: "1",
          unitPrice: "150336.13",
          discountAmount: "0",
          subtotalAmount: "150336.13",
          taxAmount: "28563.87",
          totalAmount: "178900.00",
          taxes: [],
        },
        {
          sourceLineId: "target-line-3",
          description: "Target line 3",
          quantity: "1",
          unitPrice: "59297.52",
          discountAmount: "3495.00",
          subtotalAmount: "55802.52",
          taxAmount: "10602.48",
          totalAmount: "66405.00",
          taxes: [],
        },
      ],
      {
        subtotalAmount: "259079.83",
        discountAmount: "3495.00",
        taxAmount: "49225.17",
        totalAmount: "308305.00",
      },
    ),
  );
});

test("snapshot totals reject inconsistent totals before provider invocation", async () => {
  const harness = buildHarness();
  const envelope = buildEnvelope({
    payload: {
      ...buildEnvelope().payload,
      totals: { subtotalAmount: "1000", discountAmount: "0", taxAmount: "190", totalAmount: "1191" },
    },
  });

  const result = await harness.consumer.consume(envelope);

  assert.equal(result.status, "INVALID_EVENT");
  assert.equal(harness.billingService.calls.length, 0);
});

test("consumer allows a replacement event after FAILED history for the same business source", async () => {
  const failed = {
    id: "inbox-failed",
    event_id: "event-failed",
    event_type: "SALE_COMPLETED_FOR_ELECTRONIC_BILLING",
    schema_version: 1,
    tenant_id: ids.tenant,
    correlation_id: "corr-failed",
    source_type: "SALE",
    source_id: "sale-1",
    external_reference: "SALE-tenant-sale-1",
    payload_hash: "hash-failed",
    payload: buildEnvelope().payload,
    status: "FAILED",
    electronic_document_id: null,
    received_at: new Date("2026-08-28T00:00:00.000Z"),
    processed_at: null,
    last_error_code: "LOCAL_VALIDATION",
    last_error_message: "validation failed",
    created_at: new Date("2026-08-28T00:00:00.000Z"),
    updated_at: new Date("2026-08-28T00:01:00.000Z"),
  };

  const replacement = buildEnvelope({ eventId: "event-replacement" });
  const harness = buildHarness({ existing: failed });
  const result = await harness.consumer.consume(replacement);

  assert.equal(result.status, "ACCEPTED");
  assert.equal(harness.billingService.calls.length, 1);
  assert.equal(harness.records.get("event-failed")?.status, "FAILED");
  assert.equal(harness.records.get("event-replacement")?.status, "PROCESSED");
});

test("controller rejects missing internal token", async () => {
  const previous = process.env.API_INTERNAL_TOKEN;
  delete process.env.API_INTERNAL_TOKEN;

  try {
    const controller = new ElectronicBillingSaleEventController({
      consume: async () => ({
        status: "ACCEPTED",
        eventId: "event-1",
        tenantId: ids.tenant,
        sourceType: "SALE",
        sourceId: "sale-1",
        externalReference: "SALE-tenant-sale",
        electronicDocumentId: "document-1",
        retryable: false,
        message: null,
      }),
    } as never);

    await assert.rejects(
      () => controller.receiveSaleCompletedEvent("Bearer secret", buildEnvelope()),
      /Internal auth token is not configured|Invalid internal authorization token|Missing internal authorization token/,
    );
  } finally {
    if (previous === undefined) {
      delete process.env.API_INTERNAL_TOKEN;
    } else {
      process.env.API_INTERNAL_TOKEN = previous;
    }
  }
});

test("controller accepts valid internal token", async () => {
  const previous = process.env.API_INTERNAL_TOKEN;
  process.env.API_INTERNAL_TOKEN = "secret-token";

  try {
    let calls = 0;
    const controller = new ElectronicBillingSaleEventController({
      consume: async () => {
        calls += 1;
        return {
          status: "ACCEPTED",
          eventId: "event-1",
          tenantId: ids.tenant,
          sourceType: "SALE",
          sourceId: "sale-1",
          externalReference: "SALE-tenant-sale",
          electronicDocumentId: "document-1",
          retryable: false,
          message: null,
        };
      },
    } as never);

    const result = await controller.receiveSaleCompletedEvent(
      "Bearer secret-token",
      buildEnvelope(),
    );

    assert.equal(result.status, "ACCEPTED");
    assert.equal(calls, 1);
  } finally {
    if (previous === undefined) {
      delete process.env.API_INTERNAL_TOKEN;
    } else {
      process.env.API_INTERNAL_TOKEN = previous;
    }
  }
});
