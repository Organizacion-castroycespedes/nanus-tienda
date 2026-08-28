import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicBillingProviderError } from "./contracts/electronic-billing-errors";
import { ElectronicBillingProcessingService } from "./electronic-billing-processing.service";
import type {
  ElectronicBillingProviderContext,
  ElectronicBillingProviderDocumentResult,
  ElectronicBillingProviderStatusResult,
} from "./contracts/electronic-billing-commands";
import type {
  ElectronicDocumentEventRecord,
  ElectronicDocumentLineRecord,
  ElectronicDocumentRecord,
  ElectronicDocumentReferenceRecord,
  ElectronicDocumentStatus,
  ElectronicDocumentTaxRecord,
} from "./types/electronic-billing-records";

const tenantId = "00000000-0000-0000-0000-000000002001";
const providerId = "00000000-0000-0000-0000-000000002002";
const providerConfigId = "00000000-0000-0000-0000-000000002003";
const invoiceDocumentId = "00000000-0000-0000-0000-000000002004";
const invoiceLineId = "00000000-0000-0000-0000-000000002005";
const creditDocumentId = "00000000-0000-0000-0000-000000002006";
const creditLineId = "00000000-0000-0000-0000-000000002007";
const originalDocumentId = "00000000-0000-0000-0000-000000002008";
const originalLineId = "00000000-0000-0000-0000-000000002009";

const baseContext: ElectronicBillingProviderContext = {
  tenantId,
  providerId,
  providerConfigId,
  environment: "TEST",
  baseUrl: "https://factucore.test",
  credentialReference: "cred-1",
  settings: {},
};

const makeInvoiceDocument = (status: ElectronicDocumentStatus = "PENDING"): ElectronicDocumentRecord => ({
  id: invoiceDocumentId,
  tenant_id: tenantId,
  provider_id: providerId,
  provider_config_id: providerConfigId,
  document_type: "INVOICE",
  source_type: "SALE",
  source_id: "sale-1",
  external_reference: "SALE-001",
  provider_document_id: null,
  prefix: null,
  number: null,
  full_number: null,
  status,
  provider_status: null,
  provider_status_detail: null,
  cufe: null,
  cude: null,
  currency_code: "COP",
  subtotal_amount: 1000,
  discount_amount: 0,
  tax_amount: 190,
  total_amount: 1190,
  issue_date: new Date("2026-08-27T10:00:00.000Z"),
  issue_time: "10:00:00",
  sent_at: null,
  accepted_at: null,
  rejected_at: null,
  last_status_check_at: null,
  last_error_code: null,
  last_error_message: null,
  metadata: {
    electronicBilling: {
      customer: {
        identification: {
          typeCode: "31",
          number: "900123456",
        },
        legalName: "Cliente Uno SAS",
        email: "cliente@example.com",
        municipalityCode: "11001",
      },
      payment: {
        methodCode: "10",
        term: "IMMEDIATE",
      },
    },
  },
  created_at: new Date(),
  updated_at: new Date(),
});

const makeInvoiceLine = (): ElectronicDocumentLineRecord => ({
  id: invoiceLineId,
  electronic_document_id: invoiceDocumentId,
  source_line_type: "SALE",
  source_line_id: "sale-line-1",
  provider_line_id: null,
  sku: "SKU-1",
  description: "Producto 1",
  quantity: 1,
  unit_code: "EA",
  unit_price: 1000,
  discount_amount: 0,
  subtotal_amount: 1000,
  tax_amount: 190,
  total_amount: 1190,
  tax_treatment: "TAXED",
  metadata: {
    electronicBilling: {
      sourceLineId: "sale-line-1",
    },
  },
  created_at: new Date(),
  updated_at: new Date(),
});

const makeCreditNoteDocument = (status: ElectronicDocumentStatus = "PENDING"): ElectronicDocumentRecord => ({
  id: creditDocumentId,
  tenant_id: tenantId,
  provider_id: providerId,
  provider_config_id: providerConfigId,
  document_type: "CREDIT_NOTE",
  source_type: "RETURN",
  source_id: "return-1",
  external_reference: "RETURN-001",
  provider_document_id: null,
  prefix: null,
  number: null,
  full_number: null,
  status,
  provider_status: null,
  provider_status_detail: null,
  cufe: null,
  cude: null,
  currency_code: "COP",
  subtotal_amount: 500,
  discount_amount: 0,
  tax_amount: 95,
  total_amount: 595,
  issue_date: new Date("2026-08-27T11:00:00.000Z"),
  issue_time: "11:00:00",
  sent_at: null,
  accepted_at: null,
  rejected_at: null,
  last_status_check_at: null,
  last_error_code: null,
  last_error_message: null,
  metadata: {
    electronicBilling: {
      customer: {
        identification: {
          typeCode: "31",
          number: "900123456",
        },
        legalName: "Cliente Uno SAS",
        email: "cliente@example.com",
        municipalityCode: "11001",
      },
    },
  },
  created_at: new Date(),
  updated_at: new Date(),
});

const makeCreditNoteLine = (): ElectronicDocumentLineRecord => ({
  id: creditLineId,
  electronic_document_id: creditDocumentId,
  source_line_type: "RETURN",
  source_line_id: "return-line-1",
  provider_line_id: null,
  sku: "SKU-1",
  description: "Producto 1 nota credito",
  quantity: 1,
  unit_code: "EA",
  unit_price: 500,
  discount_amount: 0,
  subtotal_amount: 500,
  tax_amount: 95,
  total_amount: 595,
  tax_treatment: "TAXED",
  metadata: {
    electronicBilling: {
      sourceLineId: "return-line-1",
      originalElectronicDocumentLineId: originalLineId,
    },
  },
  created_at: new Date(),
  updated_at: new Date(),
});

const makeOriginalInvoiceDocument = (): ElectronicDocumentRecord => ({
  id: originalDocumentId,
  tenant_id: tenantId,
  provider_id: providerId,
  provider_config_id: providerConfigId,
  document_type: "INVOICE",
  source_type: "SALE",
  source_id: "sale-original",
  external_reference: "SALE-ORIGINAL",
  provider_document_id: "FACTU-ORIGIN-1",
  prefix: "FC",
  number: 1,
  full_number: "FC-1",
  status: "ACCEPTED",
  provider_status: "ACCEPTED",
  provider_status_detail: null,
  cufe: "CUFE-1",
  cude: null,
  currency_code: "COP",
  subtotal_amount: 1000,
  discount_amount: 0,
  tax_amount: 190,
  total_amount: 1190,
  issue_date: new Date("2026-08-26T10:00:00.000Z"),
  issue_time: "10:00:00",
  sent_at: new Date("2026-08-26T10:05:00.000Z"),
  accepted_at: new Date("2026-08-26T10:10:00.000Z"),
  rejected_at: null,
  last_status_check_at: new Date("2026-08-26T10:10:00.000Z"),
  last_error_code: null,
  last_error_message: null,
  metadata: {
    electronicBilling: {
      customer: {
        identification: {
          typeCode: "31",
          number: "900123456",
        },
        legalName: "Cliente Uno SAS",
        email: "cliente@example.com",
        municipalityCode: "11001",
      },
      payment: {
        methodCode: "10",
        term: "IMMEDIATE",
      },
    },
  },
  created_at: new Date(),
  updated_at: new Date(),
});

const makeOriginalInvoiceLine = (): ElectronicDocumentLineRecord => ({
  id: originalLineId,
  electronic_document_id: originalDocumentId,
  source_line_type: "SALE",
  source_line_id: "sale-original-line",
  provider_line_id: "FACTU-LINE-ORIGIN-1",
  sku: "SKU-1",
  description: "Producto original",
  quantity: 1,
  unit_code: "EA",
  unit_price: 1000,
  discount_amount: 0,
  subtotal_amount: 1000,
  tax_amount: 190,
  total_amount: 1190,
  tax_treatment: "TAXED",
  metadata: {
    electronicBilling: {
      sourceLineId: "sale-original-line",
    },
  },
  created_at: new Date(),
  updated_at: new Date(),
});

const buildHarness = (overrides?: {
  document?: ElectronicDocumentRecord | null;
  lines?: ElectronicDocumentLineRecord[];
  taxes?: ElectronicDocumentTaxRecord[];
  references?: ElectronicDocumentReferenceRecord[];
  originalDocument?: ElectronicDocumentRecord | null;
  originalLines?: ElectronicDocumentLineRecord[];
  providerResult?: ElectronicBillingProviderDocumentResult;
  statusResult?: ElectronicBillingProviderStatusResult;
  providerError?: Error;
}) => {
  const state = {
    document: overrides?.document ?? makeInvoiceDocument(),
    lines: overrides?.lines ?? [makeInvoiceLine()],
    taxes:
      overrides?.taxes ??
      [
        {
          id: "tax-1",
          electronic_document_id: invoiceDocumentId,
          electronic_document_line_id: invoiceLineId,
          tax_type: "IVA",
          tax_code: "01",
          tax_scheme_id: "01",
          tax_scheme_name: "IVA",
          rate: 19,
          taxable_base: 1000,
          tax_amount: 190,
          metadata: {},
          created_at: new Date(),
        },
      ],
    references:
      overrides?.references ??
      [],
    events: [] as ElectronicDocumentEventRecord[],
    originalDocument: overrides?.originalDocument ?? null,
    originalLines: overrides?.originalLines ?? [],
  };

  const queries: string[] = [];
  const client = {
    query: async (text: string) => {
      queries.push(String(text).trim().split(/\s+/)[0].toUpperCase());
      return { rows: [] };
    },
    release: () => undefined,
  };

  const documentRepository = {
    findById: async (_tenant: string, id: string) => {
      if (state.document?.id === id) {
        return state.document;
      }
      if (state.originalDocument?.id === id) {
        return state.originalDocument;
      }
      return null;
    },
    findByExternalReference: async () => null,
    claimForProcessing: async (_tenant: string, id: string, options: { allowedStatuses: ElectronicDocumentStatus[] }) => {
      if (!state.document || state.document.id !== id) {
        return null;
      }
      if (!options.allowedStatuses.includes(state.document.status)) {
        return null;
      }
      state.document = {
        ...state.document,
        status: "PROCESSING",
        last_status_check_at: new Date(),
        updated_at: new Date(),
      };
      return state.document;
    },
    updateProviderIdentity: async (_tenant: string, id: string, updates: Record<string, unknown>) => {
      if (!state.document || state.document.id !== id) {
        return null;
      }
      state.document = {
        ...state.document,
        provider_document_id: (updates.providerDocumentId as string | null | undefined) ?? state.document.provider_document_id,
        prefix: (updates.prefix as string | null | undefined) ?? state.document.prefix,
        number: (updates.number as number | string | null | undefined) ?? state.document.number,
        full_number: (updates.fullNumber as string | null | undefined) ?? state.document.full_number,
        cufe: (updates.cufe as string | null | undefined) ?? state.document.cufe,
        cude: (updates.cude as string | null | undefined) ?? state.document.cude,
        provider_status: (updates.providerStatus as string | null | undefined) ?? state.document.provider_status,
        provider_status_detail:
          (updates.providerStatusDetail as string | null | undefined) ?? state.document.provider_status_detail,
        last_status_check_at: (updates.lastStatusCheckAt as Date | string | null | undefined) ?? state.document.last_status_check_at,
        updated_at: new Date(),
      };
      return state.document;
    },
    updateStatus: async (_tenant: string, id: string, updates: Record<string, unknown>) => {
      if (!state.document || state.document.id !== id) {
        return null;
      }
      state.document = {
        ...state.document,
        status: (updates.status as ElectronicDocumentStatus | undefined) ?? state.document.status,
        provider_status: (updates.providerStatus as string | null | undefined) ?? state.document.provider_status,
        provider_status_detail:
          (updates.providerStatusDetail as string | null | undefined) ?? state.document.provider_status_detail,
        sent_at: (updates.sentAt as Date | string | null | undefined) ?? state.document.sent_at,
        accepted_at: (updates.acceptedAt as Date | string | null | undefined) ?? state.document.accepted_at,
        rejected_at: (updates.rejectedAt as Date | string | null | undefined) ?? state.document.rejected_at,
        last_status_check_at:
          (updates.lastStatusCheckAt as Date | string | null | undefined) ?? state.document.last_status_check_at,
        updated_at: new Date(),
      };
      return state.document;
    },
    updateError: async (_tenant: string, id: string, updates: Record<string, unknown>) => {
      if (!state.document || state.document.id !== id) {
        return null;
      }
      state.document = {
        ...state.document,
        last_error_code: (updates.lastErrorCode as string | null | undefined) ?? state.document.last_error_code,
        last_error_message:
          (updates.lastErrorMessage as string | null | undefined) ?? state.document.last_error_message,
        updated_at: new Date(),
      };
      return state.document;
    },
  };

  const lineRepository = {
    findByDocumentId: async (_tenant: string, documentId: string) => {
      if (state.document?.id === documentId) {
        return state.lines;
      }
      if (state.originalDocument?.id === documentId) {
        return state.originalLines;
      }
      return [];
    },
    updateProviderLineId: async (_tenant: string, lineId: string, providerLineId: string) => {
      state.lines = state.lines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              provider_line_id: providerLineId,
              updated_at: new Date(),
            }
          : line,
      );
      state.originalLines = state.originalLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              provider_line_id: providerLineId,
              updated_at: new Date(),
            }
          : line,
      );
      return state.lines.find((line) => line.id === lineId) ?? state.originalLines.find((line) => line.id === lineId) ?? null;
    },
  };

  const taxRepository = {
    findByDocumentId: async (_tenant: string, documentId: string) =>
      state.document?.id === documentId ? state.taxes : [],
  };

  const referenceRepository = {
    findByDocumentId: async (_tenant: string, documentId: string) =>
      state.document?.id === documentId ? state.references : [],
  };

  const eventRepository = {
    append: async (input: Record<string, unknown>) => {
      const event = {
        id: input.id as string,
        electronic_document_id: input.electronicDocumentId as string,
        event_type: input.eventType as ElectronicDocumentEventRecord["event_type"],
        status: (input.status as ElectronicDocumentStatus | null) ?? null,
        provider_status: (input.providerStatus as string | null) ?? null,
        operation: input.operation as string,
        attempt: (input.attempt as number) ?? 1,
        http_status: (input.httpStatus as number | null) ?? null,
        error_code: (input.errorCode as string | null) ?? null,
        error_message: (input.errorMessage as string | null) ?? null,
        metadata: (input.metadata as Record<string, unknown>) ?? {},
        created_at: input.createdAt as Date,
      } as ElectronicDocumentEventRecord;
      state.events.push(event);
      return event;
    },
    listByDocumentId: async (_tenant: string, documentId: string) =>
      state.document?.id === documentId ? state.events : [],
  };

  const providerCalls: Array<{ op: string; command: unknown }> = [];
  const provider = {
    code: "FAKE",
    capabilities: {
      invoice: true,
      creditNote: true,
      debitNote: false,
      retry: true,
      pdf: false,
      xml: false,
      signedXml: false,
      asyncStatus: true,
      attachmentDownload: false,
    },
    issueInvoice: async (command: unknown) => {
      providerCalls.push({ op: "issueInvoice", command });
      if (overrides?.providerError) {
        throw overrides.providerError;
      }
      assert.equal(queries.at(-1), "COMMIT");
      return (
        overrides?.providerResult ?? {
          documentId: invoiceDocumentId,
          providerDocumentId: "FACTU-1",
          providerStatus: "SENT",
          normalizedStatus: "PROCESSING",
          prefix: "FC",
          number: "1",
          fullNumber: "FC-1",
          metadata: {
            lineResults: [
              {
                index: 0,
                providerLineId: "FACTU-LINE-1",
                originLineId: "sale-line-1",
                lineNumber: 1,
              },
            ],
          },
        }
      ) as ElectronicBillingProviderDocumentResult;
    },
    issueCreditNote: async (command: unknown) => {
      providerCalls.push({ op: "issueCreditNote", command });
      if (overrides?.providerError) {
        throw overrides.providerError;
      }
      assert.equal(queries.at(-1), "COMMIT");
      return (
        overrides?.providerResult ?? {
          documentId: creditDocumentId,
          providerDocumentId: "FACTU-CN-1",
          providerStatus: "SENT",
          normalizedStatus: "PROCESSING",
          prefix: "FC",
          number: "2",
          fullNumber: "FC-2",
          metadata: {
            lineResults: [
              {
                index: 0,
                providerLineId: "FACTU-CN-LINE-1",
                originLineId: "FACTU-LINE-ORIGIN-1",
                lineNumber: 1,
              },
            ],
          },
        }
      ) as ElectronicBillingProviderDocumentResult;
    },
    getDocumentStatus: async () =>
      (
        providerCalls.push({ op: "getDocumentStatus", command: null }),
        overrides?.statusResult ?? {
          documentId: invoiceDocumentId,
          providerDocumentId: "FACTU-1",
          providerStatus: "ACCEPTED",
          normalizedStatus: "ACCEPTED",
          acceptedAt: new Date(),
          metadata: {},
        }
      ) as ElectronicBillingProviderStatusResult,
    retryDocument: async () =>
      (
        providerCalls.push({ op: "retryDocument", command: null }),
        overrides?.statusResult ?? {
          documentId: invoiceDocumentId,
          providerDocumentId: "FACTU-1",
          providerStatus: "PENDING_RETRY",
          normalizedStatus: "PROCESSING",
          metadata: {},
        }
      ) as ElectronicBillingProviderStatusResult,
  };

  const providerResolver = {
    resolve: async () => ({
      provider,
      context: baseContext,
      config: {
        configId: providerConfigId,
        tenantId,
        providerId,
        providerCode: "FAKE",
        providerName: "Fake",
        environment: "TEST" as const,
        enabled: true,
        baseUrl: "https://factucore.test",
        credentialReference: "cred-1",
        settings: {},
        isDefault: true,
      },
    }),
  };

  const db = {
    getClient: async () => client,
  };

  const service = new ElectronicBillingProcessingService(
    db as never,
    documentRepository as never,
    lineRepository as never,
    taxRepository as never,
    referenceRepository as never,
    eventRepository as never,
    providerResolver as never,
  );

  return {
    service,
    state,
    queries,
    providerCalls,
  };
};

test("processDocument claims with a short transaction and persists provider line ids", async () => {
  const harness = buildHarness();

  const result = await harness.service.processDocument(tenantId, invoiceDocumentId);

  assert.equal(result.document.status, "PROCESSING");
  assert.equal(result.document.provider_status, "SENT");
  assert.equal(harness.state.lines[0].provider_line_id, "FACTU-LINE-1");
  assert.deepEqual(harness.queries.slice(0, 2), ["BEGIN", "COMMIT"]);
  assert.equal(harness.providerCalls.length, 1);
  assert.equal(result.events.some((event) => event.event_type === "PROCESSING_STARTED"), true);
  assert.equal(result.events.some((event) => event.event_type === "STATUS_CHANGED"), false);
});

test("processDocument returns accepted when provider does", async () => {
  const harness = buildHarness({
    providerResult: {
      documentId: invoiceDocumentId,
      providerDocumentId: "FACTU-1",
      providerStatus: "ACCEPTED",
      normalizedStatus: "ACCEPTED",
      acceptedAt: new Date("2026-08-27T12:00:00.000Z"),
      metadata: {},
    },
  });

  const result = await harness.service.processDocument(tenantId, invoiceDocumentId);

  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(result.document.accepted_at instanceof Date, true);
  assert.equal(result.events.some((event) => event.event_type === "STATUS_CHANGED"), true);
});

test("refreshDocumentStatus updates accepted state without another process claim", async () => {
  const harness = buildHarness({
    document: makeInvoiceDocument("PROCESSING"),
    statusResult: {
      documentId: invoiceDocumentId,
      providerDocumentId: "FACTU-1",
      providerStatus: "ACCEPTED",
      normalizedStatus: "ACCEPTED",
      acceptedAt: new Date("2026-08-27T13:00:00.000Z"),
      metadata: {},
    },
  });

  harness.state.document = {
    ...harness.state.document!,
    provider_document_id: "FACTU-1",
  };

  const result = await harness.service.refreshDocumentStatus(tenantId, invoiceDocumentId);

  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(result.document.provider_status, "ACCEPTED");
  assert.equal(result.document.accepted_at instanceof Date, true);
});

test("retryDocument reuses existing document and calls provider retry", async () => {
  const harness = buildHarness({
    document: makeInvoiceDocument("TECHNICAL_ERROR"),
    statusResult: {
      documentId: invoiceDocumentId,
      providerDocumentId: "FACTU-1",
      providerStatus: "PENDING_RETRY",
      normalizedStatus: "PROCESSING",
      metadata: {},
    },
  });

  harness.state.document = {
    ...harness.state.document!,
    provider_document_id: "FACTU-1",
  };

  const result = await harness.service.retryDocument(tenantId, invoiceDocumentId);

  assert.equal(result.document.status, "PROCESSING");
  assert.equal(harness.providerCalls[0].op, "retryDocument");
  assert.equal(result.events.some((event) => event.event_type === "RETRY_REQUESTED"), true);
});

test("processDocument rejects already processing documents", async () => {
  const harness = buildHarness({
    document: makeInvoiceDocument("PROCESSING"),
  });

  await assert.rejects(
    () => harness.service.processDocument(tenantId, invoiceDocumentId),
    /already being processed/,
  );
  assert.equal(harness.providerCalls.length, 0);
});

test("processDocument maps provider conflict error to rejected status", async () => {
  const harness = buildHarness({
    providerError: new ElectronicBillingProviderError("Conflict", "FACTUCORE_CONFLICT"),
  });

  const result = await harness.service.processDocument(tenantId, invoiceDocumentId);

  assert.equal(result.document.status, "REJECTED");
  assert.equal(result.document.last_error_code, "FACTUCORE_CONFLICT");
  assert.equal(result.retryable, false);
});

test("processDocument maps provider timeout error to technical error", async () => {
  const harness = buildHarness({
    providerError: new ElectronicBillingProviderError("Timeout", "FACTUCORE_TIMEOUT"),
  });

  const result = await harness.service.processDocument(tenantId, invoiceDocumentId);

  assert.equal(result.document.status, "TECHNICAL_ERROR");
  assert.equal(result.document.last_error_code, "FACTUCORE_TIMEOUT");
  assert.equal(result.retryable, true);
});

test("credit note processing keeps original line identity from original invoice", async () => {
  const harness = buildHarness({
    document: makeCreditNoteDocument(),
    lines: [makeCreditNoteLine()],
    taxes: [
      {
        id: "tax-cn-1",
        electronic_document_id: creditDocumentId,
        electronic_document_line_id: creditLineId,
        tax_type: "IVA",
        tax_code: "01",
        tax_scheme_id: "01",
        tax_scheme_name: "IVA",
        rate: 19,
        taxable_base: 500,
        tax_amount: 95,
        metadata: {},
        created_at: new Date(),
      },
    ],
    references: [
      {
        id: "ref-1",
        electronic_document_id: creditDocumentId,
        referenced_electronic_document_id: originalDocumentId,
        reference_type: "ORIGIN",
        provider_referenced_document_id: "FACTU-ORIGIN-1",
        reference_number: "FC-1",
        external_reference: "SALE-ORIGINAL",
        reason_code: "01",
        reason_description: "Devolucion parcial",
        metadata: {},
        created_at: new Date(),
      },
    ],
    originalDocument: makeOriginalInvoiceDocument(),
    originalLines: [makeOriginalInvoiceLine()],
  });

  const result = await harness.service.processDocument(tenantId, creditDocumentId);
  const providerCommand = harness.providerCalls[0].command as {
    lines: Array<{ providerOriginalLineId?: string | null; originalElectronicDocumentLineId?: string | null }>;
  };

  assert.equal(providerCommand.lines[0].providerOriginalLineId, "FACTU-LINE-ORIGIN-1");
  assert.equal(result.document.provider_status, "SENT");
  assert.equal(harness.state.lines[0].provider_line_id, "FACTU-CN-LINE-1");
});
