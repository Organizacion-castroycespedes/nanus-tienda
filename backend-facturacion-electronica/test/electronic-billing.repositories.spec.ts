import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import {
  ElectronicBillingProviderRepository,
  ElectronicDocumentAttachmentRepository,
  ElectronicDocumentConflictError,
  ElectronicDocumentDeliveryRepository,
  ElectronicDocumentEventRepository,
  ElectronicDocumentLineRepository,
  ElectronicDocumentReferenceRepository,
  ElectronicDocumentRepository,
  ElectronicDocumentTaxRepository,
  TenantElectronicBillingConfigRepository,
} from "../src/modules/electronic-billing";

type RecordedCall = {
  text: string;
  params: unknown[];
};

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  provider: "00000000-0000-0000-0000-000000000002",
  config: "00000000-0000-0000-0000-000000000003",
  document: "00000000-0000-0000-0000-000000000004",
  line: "00000000-0000-0000-0000-000000000005",
  tax: "00000000-0000-0000-0000-000000000006",
  reference: "00000000-0000-0000-0000-000000000007",
  event: "00000000-0000-0000-0000-000000000008",
  attachment: "00000000-0000-0000-0000-000000000009",
  delivery: "00000000-0000-0000-0000-000000000010",
  sourceId: "00000000-0000-0000-0000-000000000011",
};

const buildDb = (rows: unknown[] = [], throwError?: unknown) => {
  const calls: RecordedCall[] = [];
  return {
    calls,
    db: {
      query: async (text: string, params: unknown[]) => {
        calls.push({ text, params });
        if (throwError) {
          throw throwError;
        }
        return { rows };
      },
    },
  };
};

const buildClient = (rows: unknown[] = []) => {
  const calls: RecordedCall[] = [];
  const client = {
    query: async (text: string, params: unknown[]) => {
      calls.push({ text, params });
      return { rows };
    },
  };

  return { calls, client: client as unknown as PoolClient };
};

test("provider repository finds provider by code", async () => {
  const { calls, db } = buildDb([{ id: ids.provider, code: "FACTUCORE" }]);
  const repository = new ElectronicBillingProviderRepository(db as never);

  const result = await repository.findByCode("FACTUCORE");

  assert.equal(result?.code, "FACTUCORE");
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /FROM electronic_billing_providers/);
  assert.deepEqual(calls[0].params, ["FACTUCORE"]);
});

test("tenant config repository can resolve default enabled config", async () => {
  const { calls, db } = buildDb([{ id: ids.config, tenant_id: ids.tenant }]);
  const repository = new TenantElectronicBillingConfigRepository(db as never);

  const result = await repository.findDefaultForTenant(ids.tenant);

  assert.equal(result?.id, ids.config);
  assert.match(calls[0].text, /is_default = TRUE/);
  assert.match(calls[0].text, /enabled = TRUE/);
  assert.deepEqual(calls[0].params, [ids.tenant]);
});

test("document repository creates pending documents with nullable provider fields", async () => {
  const { calls, db } = buildDb([{ id: ids.document, provider_document_id: null }]);
  const repository = new ElectronicDocumentRepository(db as never);

  const result = await repository.create({
    id: ids.document,
    tenantId: ids.tenant,
    providerId: ids.provider,
    providerConfigId: ids.config,
    documentType: "INVOICE",
    sourceType: "SALE",
    sourceId: ids.sourceId,
    externalReference: "SALE-001",
    providerDocumentId: null,
    prefix: null,
    number: null,
    fullNumber: null,
    status: "PENDING",
    providerStatus: null,
    providerStatusDetail: null,
    cufe: null,
    cude: null,
    currencyCode: "COP",
    subtotalAmount: 1000,
    discountAmount: 0,
    taxAmount: 190,
    totalAmount: 1190,
    metadata: { source: "sale" },
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
    updatedAt: new Date("2026-08-27T00:00:00.000Z"),
  });

  assert.equal(result?.provider_document_id, null);
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /INSERT INTO electronic_documents/);
  assert.deepEqual(calls[0].params.slice(0, 9), [
    ids.document,
    ids.tenant,
    ids.provider,
    ids.config,
    "INVOICE",
    "SALE",
    ids.sourceId,
    "SALE-001",
    null,
  ]);
});

test("document repository maps unique violation to conflict error", async () => {
  const { db } = buildDb([], { code: "23505" });
  const repository = new ElectronicDocumentRepository(db as never);

  await assert.rejects(
    () =>
      repository.create({
        id: ids.document,
        tenantId: ids.tenant,
        providerId: ids.provider,
        providerConfigId: ids.config,
        documentType: "INVOICE",
        sourceType: "SALE",
        externalReference: "SALE-001",
        subtotalAmount: 1000,
        discountAmount: 0,
        taxAmount: 190,
        totalAmount: 1190,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ElectronicDocumentConflictError
  );
});

test("document repository updates status with explicit fields", async () => {
  const { calls, db } = buildDb([{ id: ids.document }]);
  const repository = new ElectronicDocumentRepository(db as never);

  await repository.updateStatus(ids.tenant, ids.document, {
    status: "ACCEPTED",
    providerStatus: "ACCEPTED",
    sentAt: new Date("2026-08-27T01:00:00.000Z"),
    acceptedAt: new Date("2026-08-27T01:05:00.000Z"),
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /UPDATE electronic_documents/);
  assert.match(calls[0].text, /status = \$3/);
  assert.match(calls[0].text, /provider_status = \$4/);
});

test("document repository finds by source with tenant safety", async () => {
  const { calls, db } = buildDb([{ id: ids.document, source_id: ids.sourceId }]);
  const repository = new ElectronicDocumentRepository(db as never);

  const result = await repository.findBySource(ids.tenant, "SALE", ids.sourceId, "INVOICE");

  assert.equal(result?.id, ids.document);
  assert.match(calls[0].text, /tenant_id = \$1/);
  assert.match(calls[0].text, /source_type = \$2/);
  assert.match(calls[0].text, /document_type = \$4/);
});

test("document repository claims due background sync rows tenant safely", async () => {
  const { calls, db } = buildDb([{ id: ids.document, latest_attempt: 3 }]);
  const repository = new ElectronicDocumentRepository(db as never);

  const result = await repository.claimDueForBackgroundSync({
    statuses: ["PROCESSING", "TECHNICAL_ERROR"],
    dueBefore: new Date("2026-08-27T00:00:00.000Z"),
    limit: 5,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].latest_attempt, 3);
  assert.match(calls[0].text, /FOR UPDATE SKIP LOCKED/);
  assert.match(calls[0].text, /last_status_check_at/);
});

test("document repository scopes initial claims to pre-provider documents without provider identity", async () => {
  const { calls, db } = buildDb([]);
  const repository = new ElectronicDocumentRepository(db as never);

  await repository.claimDueForBackgroundSync({
    statuses: ["PENDING"],
    processingStages: ["PRE_PROVIDER_CREATE"],
    providerDocumentIdAbsent: true,
    dueBefore: new Date("2026-08-27T00:00:00.000Z"),
    limit: 5,
  });

  assert.match(calls[0].text, /processing_stage = ANY\(\$5::text\[\]\)/);
  assert.match(calls[0].text, /provider_document_id IS NULL/);
  assert.deepEqual(calls[0].params[0], ["PENDING"]);
  assert.deepEqual(calls[0].params[4], ["PRE_PROVIDER_CREATE"]);
  assert.equal(calls[0].params[5], true);
});

test("background retry claim excludes provider-create intent without provider id", async () => {
  const { calls, db } = buildDb([]);
  const repository = new ElectronicDocumentRepository(db as never);

  await repository.claimDueForBackgroundSync({
    statuses: ["TECHNICAL_ERROR"],
    excludePreProviderIntentWithoutProvider: true,
    dueBefore: new Date("2026-08-27T00:00:00.000Z"),
    limit: 5,
  });

  assert.match(calls[0].text, /PROVIDER_CREATE_INTENT/);
  assert.match(calls[0].text, /provider_document_id IS NULL/);
  assert.equal(calls[0].params[6], true);
});

test("document repository resets only an idle provider-create intent failure", async () => {
  const { calls, db } = buildDb([{ id: ids.document }]);
  const repository = new ElectronicDocumentRepository(db as never);

  const result = await repository.recoverPreProviderCreateFailure(
    ids.tenant,
    ids.document,
    "SALE-501",
  );

  assert.equal(result, ids.document);
  assert.match(calls[0].text, /status = 'PENDING'/);
  assert.match(calls[0].text, /processing_stage = 'PRE_PROVIDER_CREATE'/);
  assert.match(calls[0].text, /status = 'TECHNICAL_ERROR'/);
  assert.match(calls[0].text, /processing_stage = 'PROVIDER_CREATE_INTENT'/);
  assert.match(calls[0].text, /provider_document_id IS NULL/);
  assert.doesNotMatch(calls[0].text, /last_status_check_at <= NOW\(\)/);
  assert.deepEqual(calls[0].params, [ids.tenant, ids.document, "SALE-501"]);
});

test("lines repository uses bulk insert and tenant-safe reads", async () => {
  const { calls, db } = buildDb([{ id: ids.line }]);
  const repository = new ElectronicDocumentLineRepository(db as never);

  const result = await repository.insertMany([
    {
      id: ids.line,
      electronicDocumentId: ids.document,
      sourceLineType: "SALE",
      sourceLineId: ids.sourceId,
      providerLineId: null,
      sku: "SKU-1",
      description: "Line 1",
      quantity: 1,
      unitCode: "EA",
      unitPrice: 1000,
      discountAmount: 0,
      subtotalAmount: 1000,
      taxAmount: 190,
      totalAmount: 1190,
      metadata: {},
      createdAt: new Date("2026-08-27T00:00:00.000Z"),
      updatedAt: new Date("2026-08-27T00:00:00.000Z"),
    },
  ]);

  assert.equal(result.length, 1);
  assert.match(calls[0].text, /INSERT INTO electronic_document_lines/);
  assert.match(calls[0].text, /RETURNING/);
});

test("tax repository bulk inserts snapshots", async () => {
  const { calls, db } = buildDb([{ id: ids.tax }]);
  const repository = new ElectronicDocumentTaxRepository(db as never);

  const result = await repository.insertMany([
    {
      id: ids.tax,
      electronicDocumentId: ids.document,
      electronicDocumentLineId: ids.line,
      taxType: "IVA",
      taxCode: "01",
      rate: 19,
      taxableBase: 1000,
      taxAmount: 190,
      metadata: {},
      createdAt: new Date("2026-08-27T00:00:00.000Z"),
    },
  ]);

  assert.equal(result.length, 1);
  assert.match(calls[0].text, /INSERT INTO electronic_document_taxes/);
});

test("reference repository creates origin links", async () => {
  const { calls, db } = buildDb([{ id: ids.reference }]);
  const repository = new ElectronicDocumentReferenceRepository(db as never);

  const result = await repository.create({
    id: ids.reference,
    electronicDocumentId: ids.document,
    referencedElectronicDocumentId: ids.sourceId,
    referenceType: "ORIGIN",
    providerReferencedDocumentId: "FC-123",
    referenceNumber: "F001",
    externalReference: "SALE-001",
    reasonCode: "1",
    reasonDescription: "Test reason",
    metadata: {},
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
  });

  assert.equal(result?.id, ids.reference);
  assert.match(calls[0].text, /INSERT INTO electronic_document_references/);
});

test("event repository appends and lists in order", async () => {
  const { calls, db } = buildDb([{ id: ids.event }]);
  const repository = new ElectronicDocumentEventRepository(db as never);

  const result = await repository.append({
    id: ids.event,
    electronicDocumentId: ids.document,
    eventType: "DOCUMENT_CREATED",
    operation: "create",
    metadata: { ok: true },
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
  });

  assert.equal(result?.id, ids.event);
  assert.match(calls[0].text, /INSERT INTO electronic_document_events/);
});

test("attachment repository stores metadata only", async () => {
  const { calls, db } = buildDb([{ id: ids.attachment }]);
  const repository = new ElectronicDocumentAttachmentRepository(db as never);

  await repository.create({
    id: ids.attachment,
    electronicDocumentId: ids.document,
    attachmentType: "XML",
    storageProvider: null,
    storageKey: null,
    fileName: "document.xml",
    mimeType: "application/xml",
    checksum: "abc123",
    sizeBytes: 1234,
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
    updatedAt: new Date("2026-08-27T00:00:00.000Z"),
  });

  assert.match(calls[0].text, /INSERT INTO electronic_document_attachments/);
});

test("delivery repository marks failures without touching document state", async () => {
  const { calls, db } = buildDb([{ id: ids.delivery }]);
  const repository = new ElectronicDocumentDeliveryRepository(db as never);

  await repository.markFailed(ids.tenant, ids.delivery, "boom");

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /UPDATE electronic_document_deliveries/);
  assert.match(calls[0].text, /last_error = \$3/);
});

test("repository methods use transaction client when provided", async () => {
  const { calls, client } = buildClient([{ id: ids.provider }]);
  const repository = new ElectronicBillingProviderRepository({ query: async () => ({ rows: [] }) } as never);

  await repository.findByCode("FACTUCORE", client);

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /FROM electronic_billing_providers/);
});
