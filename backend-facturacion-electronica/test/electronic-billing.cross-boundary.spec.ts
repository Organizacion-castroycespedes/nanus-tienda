import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { SaleCompletedForElectronicBillingConsumerService } from "../src/modules/electronic-billing";
import { ElectronicBillingSaleEventController } from "../src/modules/electronic-billing/consumers";

const fixturePath = join(
  process.cwd(),
  "test",
  "fixtures",
  "sale-completed-for-electronic-billing.v1.json",
);

const loadFixture = async () =>
  JSON.parse(await readFile(fixturePath, "utf8")) as Parameters<
    SaleCompletedForElectronicBillingConsumerService["consume"]
  >[0];

const buildConsumer = () => {
  const inbox = {
    byEventId: new Map<string, any>(),
    bySource: new Map<string, any>(),
    findByEventId: async (eventId: string) => inbox.byEventId.get(eventId) ?? null,
    findBySource: async (tenantId: string, sourceType: string, sourceId: string) =>
      inbox.bySource.get(`${tenantId}:${sourceType}:${sourceId}`) ?? null,
    insertReceived: async (input: any) => {
      const record = {
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
      inbox.byEventId.set(record.event_id, record);
      inbox.bySource.set(`${record.tenant_id}:${record.source_type}:${record.source_id}`, record);
      return record;
    },
    markProcessed: async (eventId: string, input: any) => {
      const record = inbox.byEventId.get(eventId);
      if (!record) {
        return null;
      }

      const updated = {
        ...record,
        status: "PROCESSED",
        electronic_document_id: input.electronicDocumentId,
        processed_at: input.processedAt,
      };
      inbox.byEventId.set(eventId, updated);
      inbox.bySource.set(`${updated.tenant_id}:${updated.source_type}:${updated.source_id}`, updated);
      return updated;
    },
    markFailed: async (eventId: string, input: any) => {
      const record = inbox.byEventId.get(eventId);
      if (!record) {
        return null;
      }

      const updated = {
        ...record,
        status: input.status ?? "FAILED",
        last_error_code: input.errorCode,
        last_error_message: input.errorMessage,
      };
      inbox.byEventId.set(eventId, updated);
      inbox.bySource.set(`${updated.tenant_id}:${updated.source_type}:${updated.source_id}`, updated);
      return updated;
    },
  };

  const billingService = {
    calls: [] as Array<{ command: any; source: any }>,
    createInvoiceDocument: async (command: any, _client: any, source: any) => {
      billingService.calls.push({ command, source });
      return {
        document: {
          id: "document-fixture-1",
          external_reference: command.externalReference,
          status: "PENDING",
        },
        idempotent: false,
      };
    },
  };

  const providerResolver = {
    resolve: async () => ({
      provider: { code: "FAKE_PROVIDER" },
      context: {
        tenantId: "22222222-2222-2222-2222-222222222222",
        providerId: "33333333-3333-3333-3333-333333333333",
        providerConfigId: "44444444-4444-4444-4444-444444444444",
        environment: "TEST",
        baseUrl: null,
        credentialReference: null,
        settings: {},
      },
      config: {
        configId: "44444444-4444-4444-4444-444444444444",
        tenantId: "22222222-2222-2222-2222-222222222222",
        providerId: "33333333-3333-3333-3333-333333333333",
        providerCode: "FAKE_PROVIDER",
        providerName: "Fake",
        environment: "TEST",
        enabled: true,
        baseUrl: null,
        credentialReference: null,
        settings: {},
        isDefault: true,
      },
    }),
  };

  const db = {
    transaction: async (runner: (client: any) => Promise<any>) =>
      runner({ query: async () => ({ rows: [] }), release: () => undefined }),
  };

  return new SaleCompletedForElectronicBillingConsumerService(
    db as never,
    inbox as never,
    billingService as never,
    providerResolver as never,
  );
};

test("serialized v1 event from API shape is accepted by billing backend consumer", async () => {
  const consumer = buildConsumer();
  const event = await loadFixture();

  assert.equal(event.eventType, "SALE_COMPLETED_FOR_ELECTRONIC_BILLING");
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.source.type, "SALE");

  const result = await consumer.consume(event);

  assert.equal(result.status, "ACCEPTED");
  assert.equal(result.electronicDocumentId, "document-fixture-1");
  assert.equal(result.externalReference, `SALE-${event.tenantId}-${event.source.id}`);
});

test("internal endpoint shape stays compatible with fixture", async () => {
  const previous = process.env.API_INTERNAL_TOKEN;
  process.env.API_INTERNAL_TOKEN = "fixture-token";

  try {
    const controller = new ElectronicBillingSaleEventController({
      consume: async (event: any) => ({
        status: "ACCEPTED",
        eventId: event.eventId,
        tenantId: event.tenantId,
        sourceType: "SALE",
        sourceId: event.source.id,
        externalReference: `SALE-${event.tenantId}-${event.source.id}`,
        electronicDocumentId: "document-fixture-1",
        retryable: false,
        message: null,
      }),
    } as never);

    const event = await loadFixture();
    const result = await controller.receiveSaleCompletedEvent(
      "Bearer fixture-token",
      event,
    );

    assert.equal(result.status, "ACCEPTED");
    assert.equal(result.electronicDocumentId, "document-fixture-1");
    assert.equal(result.externalReference, `SALE-${event.tenantId}-${event.source.id}`);
  } finally {
    if (previous === undefined) {
      delete process.env.API_INTERNAL_TOKEN;
    } else {
      process.env.API_INTERNAL_TOKEN = previous;
    }
  }
});
