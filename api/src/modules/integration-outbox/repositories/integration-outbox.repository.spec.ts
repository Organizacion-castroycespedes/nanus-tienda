import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { IntegrationOutboxConflictError } from "../contracts/integration-outbox.errors";
import { IntegrationOutboxRepository } from "./integration-outbox.repository";

type FakeQueryResult<T> = { rows: T[] };

const buildRepository = (responses: FakeQueryResult<any>[]) => {
  const queries: { text: string; params: unknown[] }[] = [];
  const db = {
    query: async <T>(text: string, params?: unknown[]) => {
      queries.push({ text, params: params ?? [] });
      return (responses.shift() ?? { rows: [] }) as FakeQueryResult<T>;
    },
  };

  return {
    repository: new IntegrationOutboxRepository(db as never),
    queries,
  };
};

test("enqueue writes durable outbox rows and reuses existing identity", async () => {
  const event = {
    eventId: randomUUID(),
    eventType: "SALE_COMPLETED_FOR_ELECTRONIC_BILLING" as const,
    schemaVersion: 1 as const,
    tenantId: randomUUID(),
    correlationId: randomUUID(),
    occurredAt: "2026-08-28T12:00:00.000Z",
    source: {
      type: "SALE" as const,
      id: randomUUID(),
    },
    payload: {
      sale: {
        saleId: randomUUID(),
      },
      customer: {},
      lines: [],
      taxes: [],
      payments: [],
      totals: {
        subtotalAmount: "0.00",
        discountAmount: "0.00",
        taxAmount: "0.00",
        totalAmount: "0.00",
      },
      currencyCode: "COP",
    },
  } as any;

  const existingRow = {
    id: randomUUID(),
    event_id: event.eventId,
    event_type: event.eventType,
    schema_version: 1,
    tenant_id: event.tenantId,
    correlation_id: event.correlationId,
    source_type: event.source.type,
    source_id: event.source.id,
    payload: event.payload,
    payload_hash: "same-hash",
    status: "PENDING",
    attempt_count: 0,
    next_attempt_at: "2026-08-28T12:00:00.000Z",
    lease_until: null,
    last_attempt_at: null,
    published_at: null,
    last_error: null,
    created_at: "2026-08-28T12:00:00.000Z",
    updated_at: "2026-08-28T12:00:00.000Z",
  };

  const { repository, queries } = buildRepository([
    { rows: [] },
    { rows: [existingRow] },
    { rows: [] },
    { rows: [existingRow] },
  ]);

  const inserted = await repository.enqueue({
    id: event.eventId,
    event,
    payloadHash: "same-hash",
  });

  assert.equal(inserted.event_id, event.eventId);
  assert.equal(queries[0]?.text.includes("INSERT INTO integration_outbox_events"), true);
  assert.equal(queries[0]?.text.includes("ON CONFLICT (event_id) DO NOTHING"), true);

  const duplicated = await repository.enqueue({
    id: event.eventId,
    event,
    payloadHash: "same-hash",
  });

  assert.equal(duplicated.event_id, event.eventId);
});

test("enqueue rejects same event id with a different payload", async () => {
  const event = {
    eventId: randomUUID(),
    eventType: "SALE_COMPLETED_FOR_ELECTRONIC_BILLING" as const,
    schemaVersion: 1 as const,
    tenantId: randomUUID(),
    correlationId: randomUUID(),
    occurredAt: "2026-08-28T12:00:00.000Z",
    source: {
      type: "SALE" as const,
      id: randomUUID(),
    },
    payload: {
      sale: { saleId: randomUUID() },
      customer: {},
      lines: [],
      taxes: [],
      payments: [],
      totals: {
        subtotalAmount: "0.00",
        discountAmount: "0.00",
        taxAmount: "0.00",
        totalAmount: "0.00",
      },
      currencyCode: "COP",
    },
  } as any;

  const existingRow = {
    id: randomUUID(),
    event_id: event.eventId,
    event_type: event.eventType,
    schema_version: 1,
    tenant_id: event.tenantId,
    correlation_id: event.correlationId,
    source_type: event.source.type,
    source_id: event.source.id,
    payload: event.payload,
    payload_hash: "old-hash",
    status: "PENDING",
    attempt_count: 0,
    next_attempt_at: "2026-08-28T12:00:00.000Z",
    lease_until: null,
    last_attempt_at: null,
    published_at: null,
    last_error: null,
    created_at: "2026-08-28T12:00:00.000Z",
    updated_at: "2026-08-28T12:00:00.000Z",
  };

  const { repository } = buildRepository([
    { rows: [] },
    { rows: [existingRow] },
  ]);

  await assert.rejects(
    () =>
      repository.enqueue({
        id: event.eventId,
        event,
        payloadHash: "new-hash",
      }),
    IntegrationOutboxConflictError,
  );
});

test("claimDueEvents uses FOR UPDATE SKIP LOCKED and claim lease fields", async () => {
  const claimedRow = {
    id: randomUUID(),
    event_id: randomUUID(),
    event_type: "SALE_COMPLETED_FOR_ELECTRONIC_BILLING",
    schema_version: 1,
    tenant_id: randomUUID(),
    correlation_id: randomUUID(),
    source_type: "SALE",
    source_id: randomUUID(),
    payload: {
      sale: { saleId: randomUUID() },
      customer: {},
      lines: [],
      taxes: [],
      payments: [],
      totals: {
        subtotalAmount: "0.00",
        discountAmount: "0.00",
        taxAmount: "0.00",
        totalAmount: "0.00",
      },
      currencyCode: "COP",
    },
    payload_hash: "hash",
    status: "PROCESSING",
    attempt_count: 1,
    next_attempt_at: "2026-08-28T12:00:00.000Z",
    lease_until: "2026-08-28T12:05:00.000Z",
    last_attempt_at: "2026-08-28T12:00:00.000Z",
    published_at: null,
    last_error: null,
    created_at: "2026-08-28T11:00:00.000Z",
    updated_at: "2026-08-28T12:00:00.000Z",
  } as any;

  const { repository, queries } = buildRepository([{ rows: [claimedRow] }]);

  const rows = await repository.claimDueEvents({
    now: new Date("2026-08-28T12:00:00.000Z"),
    limit: 5,
    leaseMs: 300000,
  });

  assert.equal(rows[0]?.event_id, claimedRow.event_id);
  assert.equal(queries[0]?.text.includes("FOR UPDATE SKIP LOCKED"), true);
  assert.equal(queries[0]?.text.includes("lease_until"), true);
});
