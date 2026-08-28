import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicBillingService, ElectronicDocumentOriginalNotFoundError, ElectronicDocumentTenantMismatchError, ElectronicDocumentValidationError } from "./electronic-billing.service";

const ids = {
  tenant: "00000000-0000-0000-0000-000000001001",
  provider: "00000000-0000-0000-0000-000000001002",
  config: "00000000-0000-0000-0000-000000001003",
  document: "00000000-0000-0000-0000-000000001004",
  original: "00000000-0000-0000-0000-000000001005",
  originalLine: "00000000-0000-0000-0000-000000001006",
  creditNote: "00000000-0000-0000-0000-000000001007",
  creditLine: "00000000-0000-0000-0000-000000001008",
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

const makeInvoiceCommand = () => ({
  context: baseContext,
  documentId: ids.document,
  externalReference: "SALE-500",
  issueDate: new Date("2026-08-27T00:00:00.000Z"),
  issueTime: "10:00:00",
  customer: {
    identification: {
      typeCode: "31",
      number: "900123456",
    },
    legalName: "Cliente SA",
    email: "cliente@example.com",
    municipalityCode: "11001",
    metadata: {},
  },
  payment: {
    methodCode: "10",
    term: "IMMEDIATE",
  },
  lines: [
    {
      sourceLineId: "sale-line-1",
      description: "Item 1",
      quantity: 2,
      unitCode: "EA",
      unitPrice: 500,
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
  totals: {
    subtotalAmount: 1000,
    discountAmount: 0,
    taxAmount: 190,
    totalAmount: 1190,
    currencyCode: "COP",
  },
  metadata: { source: "sale" },
});

const makeCreditNoteCommand = () => ({
  context: baseContext,
  documentId: ids.creditNote,
  externalReference: "RETURN-500",
  issueDate: new Date("2026-08-27T00:00:00.000Z"),
  issueTime: "11:00:00",
  customer: {
    identification: {
      typeCode: "31",
      number: "900123456",
    },
    legalName: "Cliente SA",
    email: "cliente@example.com",
    municipalityCode: "11001",
    metadata: {},
  },
  payment: null,
  originalDocument: {
    internalDocumentId: ids.original,
    providerDocumentId: "PROV-1",
    externalReference: "SALE-500",
    fullNumber: "FKE-1",
  },
  reason: {
    reasonCode: "01",
    reasonDescription: "Devolucion parcial",
    reasonType: "RETURN",
    metadata: {},
  },
  lines: [
    {
      sourceLineId: "return-line-1",
      originalElectronicDocumentLineId: ids.originalLine,
      providerOriginalLineId: "PROV-LINE-1",
      description: "Item 1 credit",
      quantity: 1,
      unitCode: "EA",
      unitPrice: 500,
      subtotalAmount: 500,
      taxAmount: 95,
      totalAmount: 595,
      taxes: [
        {
          type: "IVA",
          code: "01",
          rate: 19,
          taxableBase: 500,
          amount: 95,
        },
      ],
    },
  ],
  totals: {
    subtotalAmount: 500,
    discountAmount: 0,
    taxAmount: 95,
    totalAmount: 595,
    currencyCode: "COP",
  },
  metadata: { source: "return" },
});

const buildClient = () => {
  const queries: string[] = [];
  const client = {
    query: async (text: string) => {
      queries.push(text.trim());
      return { rows: [] };
    },
    release: () => undefined,
  };
  return { queries, client };
};

const buildService = (overrides?: {
  existingDocument?: any;
  originalDocument?: any;
  originalLines?: any[];
  failOnLineInsert?: boolean;
}) => {
  const documentCalls: any[] = [];
  const lineCalls: any[] = [];
  const taxCalls: any[] = [];
  const referenceCalls: any[] = [];
  const eventCalls: any[] = [];
  const { queries, client } = buildClient();

  const documentRepository = {
    findByExternalReference: async () => overrides?.existingDocument ?? null,
    create: async (input: any) => {
      documentCalls.push(input);
      return {
        id: input.id,
        tenant_id: input.tenantId,
        provider_id: input.providerId,
        provider_config_id: input.providerConfigId,
        document_type: input.documentType,
        source_type: input.sourceType,
        source_id: input.sourceId,
        external_reference: input.externalReference,
        provider_document_id: input.providerDocumentId,
        prefix: input.prefix,
        number: input.number,
        full_number: input.fullNumber,
        status: input.status,
        provider_status: input.providerStatus,
        provider_status_detail: input.providerStatusDetail,
        cufe: input.cufe,
        cude: input.cude,
        currency_code: input.currencyCode,
        subtotal_amount: input.subtotalAmount,
        discount_amount: input.discountAmount,
        tax_amount: input.taxAmount,
        total_amount: input.totalAmount,
        issue_date: input.issueDate,
        issue_time: input.issueTime,
        metadata: input.metadata,
        created_at: input.createdAt,
        updated_at: input.updatedAt,
      };
    },
    findById: async () => overrides?.originalDocument ?? null,
  };

  const lineRepository = {
    insertMany: async (items: any[]) => {
      lineCalls.push(items);
      if (overrides?.failOnLineInsert) {
        throw new Error("line insert failed");
      }
      return items.map((item) => ({ ...item }));
    },
    findByDocumentId: async () => overrides?.originalLines ?? [],
  };

  const taxRepository = {
    insertMany: async (items: any[]) => {
      taxCalls.push(items);
      return items.map((item) => ({ ...item }));
    },
    findByDocumentId: async () => [],
  };

  const referenceRepository = {
    create: async (input: any) => {
      referenceCalls.push(input);
      return { ...input };
    },
    findByDocumentId: async () => [],
  };

  const eventRepository = {
    append: async (input: any) => {
      eventCalls.push(input);
      return { ...input };
    },
    listByDocumentId: async () => [],
  };

  const db = {
    getClient: async () => client,
    query: async () => ({ rows: [] }),
  };

  const service = new ElectronicBillingService(
    db as never,
    documentRepository as never,
    lineRepository as never,
    taxRepository as never,
    referenceRepository as never,
    eventRepository as never,
  );

  return {
    service,
    queries,
    documentCalls,
    lineCalls,
    taxCalls,
    referenceCalls,
    eventCalls,
  };
};

test("createInvoiceDocument persists the internal aggregate transactionally", async () => {
  const harness = buildService();

  const result = await harness.service.createInvoiceDocument(makeInvoiceCommand());

  assert.equal(result.idempotent, false);
  assert.equal(result.document.status, "PENDING");
  assert.equal(result.document.provider_document_id, null);
  assert.equal(result.lines.length, 1);
  assert.equal(result.taxes.length, 1);
  assert.equal(result.references.length, 0);
  assert.equal(result.events.length, 1);
  assert.equal(harness.documentCalls.length, 1);
  assert.equal(harness.lineCalls.length, 1);
  assert.equal(harness.taxCalls.length, 1);
  assert.equal(harness.eventCalls.length, 1);
  assert.ok(harness.queries.includes("BEGIN"));
  assert.ok(harness.queries.includes("COMMIT"));
});

test("createInvoiceDocument returns the existing aggregate for idempotent retry", async () => {
  const existing = {
    id: ids.document,
    document_type: "INVOICE",
    status: "PENDING",
    provider_document_id: null,
  };
  const harness = buildService({
    existingDocument: existing,
  });

  const result = await harness.service.createInvoiceDocument(makeInvoiceCommand());

  assert.equal(result.idempotent, true);
  assert.equal(result.document.id, ids.document);
  assert.equal(harness.documentCalls.length, 0);
  assert.ok(harness.queries.includes("BEGIN"));
  assert.ok(harness.queries.includes("COMMIT"));
});

test("createInvoiceDocument rolls back when a child insert fails", async () => {
  const harness = buildService({
    failOnLineInsert: true,
  });

  await assert.rejects(
    () => harness.service.createInvoiceDocument(makeInvoiceCommand()),
    /line insert failed/
  );

  assert.ok(harness.queries.includes("ROLLBACK"));
});

test("createCreditNoteDocument persists original reference and line lineage", async () => {
  const harness = buildService({
    originalDocument: {
      id: ids.original,
      tenant_id: ids.tenant,
      document_type: "INVOICE",
    },
    originalLines: [
      {
        id: ids.originalLine,
        electronic_document_id: ids.original,
        source_line_type: "SALE",
        source_line_id: "sale-line-1",
      },
    ],
  });

  const result = await harness.service.createCreditNoteDocument(makeCreditNoteCommand());

  assert.equal(result.document.document_type, "CREDIT_NOTE");
  assert.equal(result.references.length, 1);
  assert.equal(result.events.length, 1);
  assert.equal(harness.referenceCalls.length, 1);
  assert.equal(harness.referenceCalls[0].referencedElectronicDocumentId, ids.original);
});

test("createCreditNoteDocument rejects missing original document", async () => {
  const harness = buildService({
    originalDocument: null,
  });

  await assert.rejects(
    () => harness.service.createCreditNoteDocument(makeCreditNoteCommand()),
    ElectronicDocumentOriginalNotFoundError
  );
});

test("createCreditNoteDocument rejects original line from another document", async () => {
  const harness = buildService({
    originalDocument: {
      id: ids.original,
      tenant_id: ids.tenant,
      document_type: "INVOICE",
    },
    originalLines: [
      {
        id: "other-line",
        electronic_document_id: ids.original,
        source_line_type: "SALE",
        source_line_id: "sale-line-1",
      },
    ],
  });

  await assert.rejects(
    () => harness.service.createCreditNoteDocument(makeCreditNoteCommand()),
    ElectronicDocumentTenantMismatchError
  );
});

test("validation rejects empty document lines", async () => {
  const harness = buildService();

  await assert.rejects(
    () =>
      harness.service.createInvoiceDocument({
        ...makeInvoiceCommand(),
        lines: [],
      }),
    ElectronicDocumentValidationError
  );
});

test("createInvoiceDocument accepts caller transaction client and source override", async () => {
  const harness = buildService();
  const transactionQueries: string[] = [];
  const transactionClient = {
    query: async (text: string) => {
      transactionQueries.push(text.replace(/\s+/g, " ").trim());
      return { rows: [] };
    },
    release: () => undefined,
  };

  const result = await harness.service.createInvoiceDocument(
    makeInvoiceCommand(),
    transactionClient as never,
    { type: "SALE", id: "sale-source-id" }
  );

  assert.equal(transactionQueries.includes("BEGIN"), false);
  assert.equal(transactionQueries.includes("COMMIT"), false);
  assert.equal(result.document.source_type, "SALE");
  assert.equal(result.document.source_id, "sale-source-id");
});
