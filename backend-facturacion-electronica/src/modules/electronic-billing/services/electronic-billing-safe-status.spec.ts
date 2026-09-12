import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicBillingProcessingService } from "./electronic-billing-processing.service";

const document = {
  id: "document-a",
  tenant_id: "tenant-a",
  provider_document_id: "provider-a",
  external_reference: "sale-a",
  status: "PROCESSING",
  provider_status: "PROCESSING",
  cufe: null,
  accepted_at: null,
};

const lockDatabase = () => ({
  getClient: async () => ({
    query: async () => ({ rows: [] }),
    release: () => undefined,
  }),
});

test("safe status reconciliation only reads provider status", async () => {
  const calls = { create: 0, generateXml: 0, sign: 0, transmit: 0, retry: 0, process: 0, status: 0 };
  const service = Object.create(ElectronicBillingProcessingService.prototype) as Record<string, unknown>;
  service.db = lockDatabase();
  service.loadAggregate = async () => ({ document, lines: [], taxes: [], references: [], events: [] });
  service.providerResolver = { resolve: async () => ({ provider: {}, context: {} }) };
  service.getProviderStatus = async () => {
    calls.status += 1;
    return {
      documentId: document.id,
      providerDocumentId: "provider-a",
      providerStatus: "ACCEPTED",
      normalizedStatus: "ACCEPTED",
      cufe: "CUFE-A",
    };
  };
  service.persistProviderResult = async () => ({
    document: { ...document, status: "ACCEPTED", provider_status: "ACCEPTED", cufe: "CUFE-A" },
    lines: [],
    taxes: [],
    references: [],
    events: [],
    providerResult: null,
    idempotent: false,
    retryable: false,
  });

  const result = await (service.reconcileExistingProviderStatus as (...args: unknown[]) => Promise<{ outcome: string }>)
    ("tenant-a", document.id);

  assert.equal(result.outcome, "UPDATED");
  assert.equal(calls.status, 1);
  assert.deepEqual(
    { create: calls.create, generateXml: calls.generateXml, sign: calls.sign, transmit: calls.transmit, retry: calls.retry, process: calls.process },
    { create: 0, generateXml: 0, sign: 0, transmit: 0, retry: 0, process: 0 },
  );
});

test("safe status reconciliation never creates when provider identity is absent", async () => {
  let providerCalls = 0;
  const service = Object.create(ElectronicBillingProcessingService.prototype) as Record<string, unknown>;
  service.db = lockDatabase();
  service.loadAggregate = async () => ({
    document: { ...document, provider_document_id: null, external_reference: "" },
    lines: [],
    taxes: [],
    references: [],
    events: [],
  });
  service.providerResolver = { resolve: async () => { providerCalls += 1; return null; } };

  const result = await (service.reconcileExistingProviderStatus as (...args: unknown[]) => Promise<{ outcome: string }>)
    ("tenant-a", document.id);

  assert.equal(result.outcome, "PROVIDER_DOCUMENT_NOT_FOUND");
  assert.equal(providerCalls, 0);
});

test("safe status reconciliation recovers an existing provider link by external reference", async () => {
  const service = Object.create(ElectronicBillingProcessingService.prototype) as Record<string, unknown>;
  service.db = lockDatabase();
  service.loadAggregate = async () => ({
    document: { ...document, provider_document_id: null },
    lines: [],
    taxes: [],
    references: [],
    events: [],
  });
  service.providerResolver = { resolve: async () => ({ provider: {}, context: {} }) };
  service.getProviderStatus = async () => ({
    documentId: document.id,
    providerDocumentId: "provider-recovered",
    providerStatus: "PROCESSING",
    normalizedStatus: "PROCESSING",
  });
  service.persistProviderResult = async () => ({
    document: { ...document, provider_document_id: "provider-recovered" },
    lines: [],
    taxes: [],
    references: [],
    events: [],
    providerResult: null,
    idempotent: false,
    retryable: false,
  });

  const result = await (service.reconcileExistingProviderStatus as (...args: unknown[]) => Promise<{ outcome: string }>)
    ("tenant-a", document.id);

  assert.equal(result.outcome, "UPDATED");
});

test("retryability is domain-owned and never approved for blind operational retry", async () => {
  const service = Object.create(ElectronicBillingProcessingService.prototype) as Record<string, unknown>;
  service.db = lockDatabase();
  for (const [status, decision] of [
    ["ACCEPTED", "FORBIDDEN_TERMINAL"],
    ["REJECTED", "FORBIDDEN_TERMINAL"],
    ["CANCELLED", "FORBIDDEN_TERMINAL"],
    ["PROCESSING", "ALREADY_PROCESSING"],
    ["PENDING", "RECONCILE_FIRST"],
    ["TECHNICAL_ERROR", "RECONCILE_FIRST"],
  ]) {
    service.loadAggregate = async () => ({
      document: {
        ...document,
        status,
        provider_document_id: status === "TECHNICAL_ERROR" ? null : document.provider_document_id,
        last_error_code: status === "TECHNICAL_ERROR" ? "NETWORK_TIMEOUT" : null,
      },
      lines: [],
      taxes: [],
      references: [],
      events: [],
    });

    const result = await (service.evaluateRetryability as (...args: unknown[]) => Promise<{ canRetry: boolean; decision: string }>)
      ("tenant-a", document.id);

    assert.equal(result.canRetry, false);
    assert.equal(result.decision, decision, status);
  }
});

test("document processing lock serializes competing executions", async () => {
  let active = 0;
  let maximumActive = 0;
  let locked = false;
  const waiters: Array<() => void> = [];
  const service = Object.create(ElectronicBillingProcessingService.prototype) as Record<string, unknown>;
  service.db = {
    getClient: async () => ({
      query: async (sql: string) => {
        if (sql.includes("pg_advisory_lock")) {
          if (locked) {
            await new Promise<void>((resolve) => waiters.push(resolve));
          }
          locked = true;
        }
        if (sql.includes("pg_advisory_unlock")) {
          locked = false;
          waiters.shift()?.();
        }
        return { rows: [] };
      },
      release: () => undefined,
    }),
  };

  const operation = async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
  };

  await Promise.all([
    (service.withDocumentProcessingLock as (...args: unknown[]) => Promise<void>)("tenant-a", "document-a", operation),
    (service.withDocumentProcessingLock as (...args: unknown[]) => Promise<void>)("tenant-a", "document-a", operation),
  ]);

  assert.equal(maximumActive, 1);
});
