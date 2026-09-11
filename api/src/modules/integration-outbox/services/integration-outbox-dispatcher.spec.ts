import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { IntegrationOutboxDispatcher } from "./integration-outbox-dispatcher";

test("dispatcher stays disabled by default when config is missing", async () => {
  const dispatcher = new IntegrationOutboxDispatcher(
    {
      enabled: false,
      scanIntervalMs: 30000,
      batchSize: 10,
      concurrencyLimit: 4,
      maxRetryAttempts: 5,
      leaseMs: 300000,
      initialBackoffMs: 30000,
      maxBackoffMs: 1800000,
      timeoutMs: 15000,
      billingBackendBaseUrl: "",
      internalToken: "",
    },
    {
      claimDueEvents: async () => [],
      markPublished: async () => undefined,
      markRetryableFailure: async () => undefined,
      markTerminalFailure: async () => undefined,
    } as never,
    {
      sendSaleCompletedEvent: async () => ({
        outcome: "PUBLISHED",
        retryable: false,
        statusCode: 200,
        message: null,
        retryAfterMs: null,
      }),
    } as never,
  );

  assert.deepEqual(await dispatcher.runOnce(), {
    published: 0,
    retryable: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
  });
});

test("dispatcher publishes success and idempotent success", async () => {
  const event = {
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

  const published: string[] = [];
  const retryable: string[] = [];
  const failed: string[] = [];
  let claims = 0;

  const dispatcher = new IntegrationOutboxDispatcher(
    {
      enabled: true,
      scanIntervalMs: 30000,
      batchSize: 10,
      concurrencyLimit: 2,
      maxRetryAttempts: 5,
      leaseMs: 300000,
      initialBackoffMs: 30000,
      maxBackoffMs: 1800000,
      timeoutMs: 15000,
      billingBackendBaseUrl: "http://billing-backend.local",
      internalToken: "secret-token",
    },
    {
      claimDueEvents: async () => {
        claims += 1;
        return claims === 1 ? [event] : [event];
      },
      markPublished: async (eventId: string) => {
        published.push(eventId);
      },
      markRetryableFailure: async (eventId: string) => {
        retryable.push(eventId);
      },
      markTerminalFailure: async (eventId: string) => {
        failed.push(eventId);
      },
    } as never,
    {
      sendSaleCompletedEvent: async () => {
        if (claims === 1) {
          return {
            outcome: "RETRYABLE_FAILURE",
            retryable: true,
            statusCode: null,
            message: "network down",
            retryAfterMs: null,
          };
        }

        return {
          outcome: "ALREADY_PROCESSED",
          retryable: false,
          statusCode: 200,
          message: null,
          retryAfterMs: null,
        };
      },
    } as never,
  );

  const first = await dispatcher.runOnce();
  const second = await dispatcher.runOnce();

  assert.equal(first.retryable, 1);
  assert.equal(second.published, 1);
  assert.equal(published.length, 1);
  assert.equal(retryable.length, 1);
  assert.equal(failed.length, 0);
});
