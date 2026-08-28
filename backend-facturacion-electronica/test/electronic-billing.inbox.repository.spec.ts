import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicBillingInboxRepository } from "../src/modules/electronic-billing";

const buildDb = () => {
  const calls: string[] = [];
  const db = {
    query: async (text: string) => {
      calls.push(text);
      return { rows: [] };
    },
  };

  return { calls, db };
};

test("inbox repository writes durable inbox records", async () => {
  const { calls, db } = buildDb();
  const repository = new ElectronicBillingInboxRepository(db as never);

  await repository.insertReceived(
    {
      id: "inbox-1",
      eventId: "event-1",
      eventType: "SALE_COMPLETED_FOR_ELECTRONIC_BILLING",
      schemaVersion: 1,
      tenantId: "00000000-0000-0000-0000-000000000601",
      correlationId: "corr-1",
      sourceType: "SALE",
      sourceId: "sale-1",
      externalReference: "SALE-tenant-sale",
      payloadHash: "hash-1",
      payload: {},
      createdAt: new Date("2026-08-28T00:00:00.000Z"),
      updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    },
    undefined,
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0], /electronic_billing_inbox_events/i);
  assert.match(calls[0], /ON CONFLICT DO NOTHING/i);
});

test("inbox repository marks processed events", async () => {
  const { calls, db } = buildDb();
  const repository = new ElectronicBillingInboxRepository(db as never);

  await repository.markProcessed("event-1", {
    electronicDocumentId: "document-1",
    processedAt: new Date("2026-08-28T00:00:00.000Z"),
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0], /SET status = 'PROCESSED'/i);
  assert.match(calls[0], /electronic_document_id = \$2/i);
});
