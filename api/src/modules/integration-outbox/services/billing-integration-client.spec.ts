import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BillingIntegrationClient } from "./billing-integration-client";

const buildEvent = () => ({
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
} as any);

test("client posts to sale completed internal endpoint with bearer auth", async () => {
  const originalFetch = globalThis.fetch;
  let captured: Request | null = null;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = new Request(input, init);
    return new Response(
      JSON.stringify({
        status: "ACCEPTED",
        eventId: "evt",
        tenantId: "tenant",
        sourceType: "SALE",
        sourceId: "sale",
        externalReference: "SALE-tenant-sale",
        electronicDocumentId: "doc",
        retryable: false,
        message: null,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const client = new BillingIntegrationClient({
      enabled: true,
      scanIntervalMs: 30000,
      batchSize: 10,
      concurrencyLimit: 4,
      maxRetryAttempts: 5,
      leaseMs: 300000,
      initialBackoffMs: 30000,
      maxBackoffMs: 1800000,
      timeoutMs: 15000,
      billingBackendBaseUrl: "http://billing-backend.local",
      internalToken: "secret-token",
    });

    const result = await client.sendSaleCompletedEvent(buildEvent());

    assert.equal(result.outcome, "PUBLISHED");
    assert.equal(captured?.url, "http://billing-backend.local/internal/electronic-billing/events/sale-completed");
    assert.equal(captured?.headers.get("authorization"), "Bearer secret-token");
    assert.equal(captured?.headers.get("content-type"), "application/json");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client classifies retryable, non-retryable, and idempotent responses", async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response(JSON.stringify({ status: "ALREADY_PROCESSED" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
    new Response(JSON.stringify({ status: "TEMPORARY_FAILURE", message: "busy" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
    new Response("bad request", { status: 422 }),
    new Response("retry later", { status: 429, headers: { "retry-after": "5" } }),
  ];

  globalThis.fetch = (async () => responses.shift() ?? new Response("ok", { status: 200 })) as typeof fetch;

  try {
    const client = new BillingIntegrationClient({
      enabled: true,
      scanIntervalMs: 30000,
      batchSize: 10,
      concurrencyLimit: 4,
      maxRetryAttempts: 5,
      leaseMs: 300000,
      initialBackoffMs: 30000,
      maxBackoffMs: 1800000,
      timeoutMs: 15000,
      billingBackendBaseUrl: "http://billing-backend.local",
      internalToken: "secret-token",
    });

    const alreadyProcessed = await client.sendSaleCompletedEvent(buildEvent());
    const temporaryFailure = await client.sendSaleCompletedEvent(buildEvent());
    const nonRetryable = await client.sendSaleCompletedEvent(buildEvent());
    const rateLimited = await client.sendSaleCompletedEvent(buildEvent());

    assert.equal(alreadyProcessed.outcome, "ALREADY_PROCESSED");
    assert.equal(temporaryFailure.outcome, "RETRYABLE_FAILURE");
    assert.equal(temporaryFailure.retryable, true);
    assert.equal(nonRetryable.outcome, "NON_RETRYABLE_FAILURE");
    assert.equal(nonRetryable.retryable, false);
    assert.equal(rateLimited.outcome, "RETRYABLE_FAILURE");
    assert.equal(rateLimited.retryAfterMs, 5000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client maps timeout and network errors to retryable failures", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new DOMException("Aborted", "AbortError");
  }) as typeof fetch;

  try {
    const client = new BillingIntegrationClient({
      enabled: true,
      scanIntervalMs: 30000,
      batchSize: 10,
      concurrencyLimit: 4,
      maxRetryAttempts: 5,
      leaseMs: 300000,
      initialBackoffMs: 30000,
      maxBackoffMs: 1800000,
      timeoutMs: 15,
      billingBackendBaseUrl: "http://billing-backend.local",
      internalToken: "secret-token",
    });

    const timeout = await client.sendSaleCompletedEvent(buildEvent());
    assert.equal(timeout.outcome, "RETRYABLE_FAILURE");
    assert.equal(timeout.retryable, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const buildClient = () => new BillingIntegrationClient({
  enabled: true,
  scanIntervalMs: 30000,
  batchSize: 10,
  concurrencyLimit: 4,
  maxRetryAttempts: 5,
  leaseMs: 300000,
  initialBackoffMs: 30000,
  maxBackoffMs: 1800000,
  timeoutMs: 15000,
  inlineTimeoutMs: 60000,
  billingBackendBaseUrl: "http://billing-backend.local",
  internalToken: "secret-token",
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const rejectedDocument = {
  electronicDocumentId: "doc-1",
  documentType: "INVOICE",
  status: "REJECTED",
  failureClass: "DIAN_REJECTED",
  retryable: false,
  errorCode: "FAK61",
  errorMessage: "Regla: FAK61",
  failures: [{ code: "FAK61", message: "Regla: FAK61", origin: "DIAN", solution: "Corregir correo" }],
};

test("client parses the electronic document outcome from sale completed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonResponse({
    status: "ACCEPTED",
    electronicDocumentId: "doc-1",
    retryable: false,
    electronicDocument: rejectedDocument,
  })) as typeof fetch;

  try {
    const result = await buildClient().sendSaleCompletedEvent(buildEvent(), { timeoutMs: 60000 });
    assert.equal(result.outcome, "PUBLISHED");
    assert.equal(result.electronicDocument?.status, "REJECTED");
    assert.equal(result.electronicDocument?.failures[0]?.solution, "Corregir correo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("issueCreditNote returns outcome, request rejection or network failure", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  const responses = [
    jsonResponse({ electronicDocument: { ...rejectedDocument, documentType: "CREDIT_NOTE", status: "ACCEPTED" } }),
    jsonResponse({ message: "Invoice is not accepted" }, 409),
    jsonResponse({ message: "busy" }, 503),
  ];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrl = String(input);
    const next = responses.shift();
    if (!next) {
      throw new TypeError("fetch failed");
    }
    return next;
  }) as typeof fetch;

  try {
    const client = buildClient();
    const accepted = await client.issueCreditNote("tenant-a", "doc-1", { noteReason: "Devolución" });
    const rejected = await client.issueCreditNote("tenant-a", "doc-1", {});
    const unavailable = await client.issueCreditNote("tenant-a", "doc-1", {});
    const network = await client.issueCreditNote("tenant-a", "doc-1", {});

    assert.equal(accepted.kind, "OUTCOME");
    assert.equal(accepted.kind === "OUTCOME" && accepted.electronicDocument.documentType, "CREDIT_NOTE");
    assert.match(capturedUrl, /\/documents\/doc-1\/credit-note\/issue$/);
    assert.equal(rejected.kind, "REQUEST_REJECTED");
    assert.equal(rejected.kind === "REQUEST_REJECTED" && rejected.statusCode, 409);
    assert.equal(unavailable.kind, "NETWORK_FAILURE");
    assert.equal(network.kind, "NETWORK_FAILURE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
