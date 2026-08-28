import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectronicBillingService,
  ElectronicDocumentOriginalNotFoundError,
  ElectronicDocumentValidationError,
} from "../src/modules/electronic-billing";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000401",
  provider: "00000000-0000-0000-0000-000000000402",
  config: "00000000-0000-0000-0000-000000000403",
  document: "00000000-0000-0000-0000-000000000404",
  line: "00000000-0000-0000-0000-000000000405",
  event: "00000000-0000-0000-0000-000000000406",
};

const baseContext = {
  tenantId: ids.tenant,
  providerId: ids.provider,
  providerConfigId: ids.config,
  environment: "TEST" as const,
  baseUrl: null,
  credentialReference: null,
  settings: {},
};

const buildCommand = (overrides: Partial<any> = {}) => ({
  context: overrides.context ?? baseContext,
  documentId: overrides.documentId ?? ids.document,
  externalReference: overrides.externalReference ?? "SALE-400",
  issueDate: overrides.issueDate ?? new Date("2026-08-27T00:00:00.000Z"),
  issueTime: overrides.issueTime ?? "10:15:00",
  customer:
    overrides.customer ?? {
      identification: {
        typeCode: "31",
        number: "900123456",
      },
      legalName: "Client SA",
      email: "client@example.com",
      municipalityCode: "11001",
      metadata: {},
    },
  payment:
    overrides.payment ?? {
      methodCode: "10",
      term: "IMMEDIATE",
    },
  lines:
    overrides.lines ?? [
      {
        sourceLineId: "line-1",
        description: "Product 1",
        quantity: 1,
        unitCode: "EA",
        unitPrice: 1000,
        subtotalAmount: 1000,
        taxAmount: 190,
        totalAmount: 1190,
        taxes: [
          {
            type: "IVA",
            code: "01",
            rate: 19,
            taxableBase: 1000,
            amount: 190,
          },
        ],
      },
    ],
  totals:
    overrides.totals ?? {
      subtotalAmount: 1000,
      discountAmount: 0,
      taxAmount: 190,
      totalAmount: 1190,
      currencyCode: "COP",
    },
  metadata: overrides.metadata ?? { source: "sale" },
});

const buildDb = () => {
  const calls: string[] = [];
  const client = {
    query: async (text: string) => {
      calls.push(text);
      return { rows: [] };
    },
    release: () => undefined,
  };

  return {
    calls,
    db: {
      getClient: async () => client,
    },
  };
};

const buildRepositories = (overrides: Record<string, any> = {}) => {
  const state = {
    document: null as any,
    lines: [] as any[],
    taxes: [] as any[],
    references: [] as any[],
    events: [] as any[],
    ...overrides,
  };

  const documentRepository = {
    findByExternalReference: async () => state.document,
    create: async (input: any) => ({
      id: input.id,
      tenant_id: input.tenantId,
      provider_id: input.providerId,
      provider_config_id: input.providerConfigId,
      document_type: input.documentType,
      source_type: input.sourceType,
      source_id: input.sourceId,
      external_reference: input.externalReference,
      provider_document_id: input.providerDocumentId ?? null,
      prefix: input.prefix ?? null,
      number: input.number ?? null,
      full_number: input.fullNumber ?? null,
      status: input.status ?? "PENDING",
      provider_status: input.providerStatus ?? null,
      provider_status_detail: input.providerStatusDetail ?? null,
      cufe: input.cufe ?? null,
      cude: input.cude ?? null,
      currency_code: input.currencyCode ?? "COP",
      subtotal_amount: input.subtotalAmount,
      discount_amount: input.discountAmount,
      tax_amount: input.taxAmount,
      total_amount: input.totalAmount,
      issue_date: input.issueDate ?? null,
      issue_time: input.issueTime ?? null,
      sent_at: input.sentAt ?? null,
      accepted_at: input.acceptedAt ?? null,
      rejected_at: input.rejectedAt ?? null,
      last_status_check_at: input.lastStatusCheckAt ?? null,
      last_error_code: input.lastErrorCode ?? null,
      last_error_message: input.lastErrorMessage ?? null,
      metadata: input.metadata ?? {},
      created_at: input.createdAt,
      updated_at: input.updatedAt,
    }),
    findById: async () => state.document,
  };

  const lineRepository = {
    insertMany: async () => state.lines,
    findByDocumentId: async () => state.lines,
  };
  const taxRepository = {
    insertMany: async () => state.taxes,
    findByDocumentId: async () => state.taxes,
  };
  const referenceRepository = {
    create: async () => state.references[0] ?? null,
    findByDocumentId: async () => state.references,
  };
  const eventRepository = {
    append: async () => state.events[0] ?? null,
    listByDocumentId: async () => state.events,
  };

  return {
    state,
    documentRepository,
    lineRepository,
    taxRepository,
    referenceRepository,
    eventRepository,
  };
};

test("create invoice aggregate persists snapshot and returns fresh aggregate", async () => {
  const { db } = buildDb();
  const repos = buildRepositories({
    lines: [
      {
        id: ids.line,
        electronic_document_id: ids.document,
        source_line_type: "SALE",
        source_line_id: "line-1",
        provider_line_id: null,
        sku: "SKU-1",
        description: "Product 1",
        quantity: 1,
        unit_code: "EA",
        unit_price: 1000,
        discount_amount: 0,
        subtotal_amount: 1000,
        tax_amount: 190,
        total_amount: 1190,
        tax_treatment: null,
        metadata: {},
        created_at: new Date("2026-08-27T00:00:00.000Z"),
        updated_at: new Date("2026-08-27T00:00:00.000Z"),
      },
    ],
    taxes: [
      {
        id: "00000000-0000-0000-0000-000000000407",
        electronic_document_id: ids.document,
        electronic_document_line_id: ids.line,
        tax_type: "IVA",
        tax_code: "01",
        tax_scheme_id: null,
        tax_scheme_name: null,
        rate: 19,
        taxable_base: 1000,
        tax_amount: 190,
        metadata: {},
        created_at: new Date("2026-08-27T00:00:00.000Z"),
      },
    ],
    references: [],
    events: [
      {
        id: ids.event,
        electronic_document_id: ids.document,
        event_type: "DOCUMENT_CREATED",
        status: "PENDING",
        provider_status: null,
        operation: "CREATE",
        attempt: 1,
        http_status: null,
        error_code: null,
        error_message: null,
        metadata: {},
        created_at: new Date("2026-08-27T00:00:00.000Z"),
      },
    ],
  });
  const service = new ElectronicBillingService(
    db as never,
    repos.documentRepository as never,
    repos.lineRepository as never,
    repos.taxRepository as never,
    repos.referenceRepository as never,
    repos.eventRepository as never,
  );

  const result = await service.createInvoiceDocument(buildCommand());

  assert.equal(result.idempotent, false);
  assert.equal(result.document.external_reference, "SALE-400");
  assert.equal(result.document.status, "PENDING");
  assert.equal(result.lines.length, 1);
  assert.equal(result.taxes.length, 1);
});

test("create invoice aggregate returns existing document as idempotent", async () => {
  const { db } = buildDb();
  const existing = {
    id: ids.document,
    external_reference: "SALE-400",
    status: "PENDING",
    provider_id: ids.provider,
    provider_config_id: ids.config,
    document_type: "INVOICE",
    source_type: "SALE",
  };
  const repos = buildRepositories({
    document: existing,
    lines: [{ id: ids.line }],
    taxes: [],
    references: [],
    events: [],
  });
  const service = new ElectronicBillingService(
    db as never,
    repos.documentRepository as never,
    repos.lineRepository as never,
    repos.taxRepository as never,
    repos.referenceRepository as never,
    repos.eventRepository as never,
  );

  const result = await service.createInvoiceDocument(buildCommand());

  assert.equal(result.idempotent, true);
  assert.equal(result.document.id, ids.document);
});

test("create credit note fails when original invoice is missing", async () => {
  const { db } = buildDb();
  const repos = buildRepositories({
    document: null,
    lines: [],
    taxes: [],
    references: [],
    events: [],
  });
  const service = new ElectronicBillingService(
    db as never,
    repos.documentRepository as never,
    repos.lineRepository as never,
    repos.taxRepository as never,
    repos.referenceRepository as never,
    repos.eventRepository as never,
  );

  await assert.rejects(
    () =>
      service.createCreditNoteDocument({
        ...buildCommand({
          documentId: ids.document,
          externalReference: "RETURN-400",
        }),
        originalDocument: {
          internalDocumentId: "00000000-0000-0000-0000-000000000499",
          providerDocumentId: "PROVIDER-499",
          externalReference: "SALE-499",
          fullNumber: "INV-499",
        },
        reason: {
          reasonCode: "01",
          reasonDescription: "Return",
          reasonType: "RETURN",
          metadata: {},
        },
      }),
    ElectronicDocumentOriginalNotFoundError,
  );
});

test("create invoice rejects empty lines", async () => {
  const { db } = buildDb();
  const repos = buildRepositories();
  const service = new ElectronicBillingService(
    db as never,
    repos.documentRepository as never,
    repos.lineRepository as never,
    repos.taxRepository as never,
    repos.referenceRepository as never,
    repos.eventRepository as never,
  );

  await assert.rejects(
    () =>
      service.createInvoiceDocument(
        buildCommand({
          lines: [],
        }),
      ),
    ElectronicDocumentValidationError,
  );
});
