import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectronicBillingProviderError,
  ElectronicBillingProcessingService,
  ElectronicDocumentAlreadyProcessingError,
  FakeElectronicBillingProvider,
} from "../src/modules/electronic-billing";
import { FactuCoreValidationError } from "../src/modules/electronic-billing/providers/factucore/factucore.errors";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000501",
  provider: "00000000-0000-0000-0000-000000000502",
  config: "00000000-0000-0000-0000-000000000503",
  document: "00000000-0000-0000-0000-000000000504",
  line: "00000000-0000-0000-0000-000000000505",
  event: "00000000-0000-0000-0000-000000000506",
};

const baseDocument = {
  id: ids.document,
  tenant_id: ids.tenant,
  provider_id: ids.provider,
  provider_config_id: ids.config,
  document_type: "INVOICE",
  source_type: "SALE",
  source_id: "sale-501",
  external_reference: "SALE-501",
  provider_document_id: null,
  prefix: null,
  number: null,
  full_number: null,
  status: "PENDING",
  provider_status: null,
  provider_status_detail: null,
  cufe: null,
  cude: null,
  currency_code: "COP",
  subtotal_amount: 1000,
  discount_amount: 0,
  tax_amount: 190,
  total_amount: 1190,
  issue_date: new Date("2026-08-27T00:00:00.000Z"),
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
        identification: { number: "900123456", typeCode: "31" },
        legalName: "Client SA",
      },
      payment: {
        methodCode: "10",
      },
    },
  },
  created_at: new Date("2026-08-27T00:00:00.000Z"),
  updated_at: new Date("2026-08-27T00:00:00.000Z"),
};

const buildState = (overrides: Partial<typeof baseDocument> = {}) => ({
  document: { ...baseDocument, ...overrides },
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
      metadata: {
        electronicBilling: {
          sourceLineId: "line-1",
        },
      },
      created_at: new Date("2026-08-27T00:00:00.000Z"),
      updated_at: new Date("2026-08-27T00:00:00.000Z"),
    },
  ],
  taxes: [
    {
      id: "00000000-0000-0000-0000-000000000507",
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

const buildHarness = (state = buildState()) => {
  const clientCalls: string[] = [];
  const client = {
    query: async (text: string) => {
      clientCalls.push(text);
      return { rows: [] };
    },
    release: () => undefined,
  };

  const db = {
    getClient: async () => client,
  };

  const applyDocumentUpdates = (updates: Record<string, unknown>) => {
    const mapped: Record<string, unknown> = { ...updates };
    if ("providerDocumentId" in updates) {
      mapped.provider_document_id = updates.providerDocumentId;
      delete mapped.providerDocumentId;
    }
    if ("providerStatus" in updates) {
      mapped.provider_status = updates.providerStatus;
      delete mapped.providerStatus;
    }
    if ("providerStatusDetail" in updates) {
      mapped.provider_status_detail = updates.providerStatusDetail;
      delete mapped.providerStatusDetail;
    }
    if ("lastStatusCheckAt" in updates) {
      mapped.last_status_check_at = updates.lastStatusCheckAt;
      delete mapped.lastStatusCheckAt;
    }
    if ("sentAt" in updates) {
      mapped.sent_at = updates.sentAt;
      delete mapped.sentAt;
    }
    if ("acceptedAt" in updates) {
      mapped.accepted_at = updates.acceptedAt;
      delete mapped.acceptedAt;
    }
    if ("rejectedAt" in updates) {
      mapped.rejected_at = updates.rejectedAt;
      delete mapped.rejectedAt;
    }
    if ("lastErrorCode" in updates) {
      mapped.last_error_code = updates.lastErrorCode;
      delete mapped.lastErrorCode;
    }
    if ("lastErrorMessage" in updates) {
      mapped.last_error_message = updates.lastErrorMessage;
      delete mapped.lastErrorMessage;
    }
    state.document = { ...state.document, ...mapped };
    return state.document;
  };

  const documentRepository = {
    findById: async () => state.document,
    claimForProcessing: async () => {
      if (state.document.status !== "PENDING" && state.document.status !== "TECHNICAL_ERROR" && state.document.status !== "REJECTED") {
        return null;
      }
      state.document = { ...state.document, status: "PROCESSING", last_status_check_at: new Date() };
      return state.document;
    },
    updateProviderIdentity: async (_tenantId: string, _id: string, updates: any) => {
      return applyDocumentUpdates(updates);
    },
    updateStatus: async (_tenantId: string, _id: string, updates: any) => {
      return applyDocumentUpdates(updates);
    },
    updateError: async (_tenantId: string, _id: string, updates: any) => {
      return applyDocumentUpdates(updates);
    },
  };

  const lineRepository = {
    findByDocumentId: async () => state.lines,
    updateProviderLineId: async (_tenantId: string, lineId: string, providerLineId: string | null) => {
      state.lines = state.lines.map((line: any) =>
        line.id === lineId ? { ...line, provider_line_id: providerLineId } : line,
      );
      return state.lines.find((line: any) => line.id === lineId) ?? null;
    },
  };

  const taxRepository = {
    findByDocumentId: async () => state.taxes,
  };

  const referenceRepository = {
    findByDocumentId: async () => state.references,
  };

  const eventRepository = {
    listByDocumentId: async () => state.events,
    append: async (input: any) => {
      const event = {
        id: input.id,
        electronic_document_id: input.electronicDocumentId,
        event_type: input.eventType,
        status: input.status ?? null,
        provider_status: input.providerStatus ?? null,
        operation: input.operation,
        attempt: input.attempt ?? 1,
        http_status: input.httpStatus ?? null,
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
        metadata: input.metadata ?? {},
        created_at: input.createdAt,
      };
      state.events = [...state.events, event];
      return event;
    },
  };

  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER");
  const providerResolver = {
    resolve: async () => ({
      provider,
      context: {
        tenantId: ids.tenant,
        providerId: ids.provider,
        providerConfigId: ids.config,
        environment: "TEST",
        baseUrl: null,
        credentialReference: null,
        settings: {},
      },
      config: {
        configId: ids.config,
        tenantId: ids.tenant,
        providerId: ids.provider,
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
    state,
    clientCalls,
    provider,
    service,
  };
};

test("processDocument issues invoice and persists provider identity", async () => {
  const harness = buildHarness();

  const result = await harness.service.processDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "PROCESSING");
  assert.equal(result.document.provider_document_id, "FAKE-00000000-0000-0000-0000-000000000504");
  assert.equal(harness.provider.received.issueInvoice.length, 1);
});

test("refreshDocumentStatus moves processing document to accepted", async () => {
  const harness = buildHarness(
    buildState({
      status: "PROCESSING",
      provider_document_id: "FAKE-123",
      provider_status: "PROCESSING",
    }),
  );
  harness.provider.getDocumentStatus = async (command) => ({
    documentId: command.documentId,
    providerDocumentId: command.providerDocumentId ?? "FAKE-123",
    providerStatus: "ACCEPTED",
    normalizedStatus: "ACCEPTED",
    providerStatusDetail: "accepted",
    prefix: "FKE",
    number: "1",
    fullNumber: "FKE-1",
    cufe: "CUFE-123",
    cude: null,
    acceptedAt: new Date("2026-08-27T01:00:00.000Z"),
    rejectedAt: null,
    metadata: {},
  });

  const result = await harness.service.refreshDocumentStatus(ids.tenant, ids.document);

  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(result.document.provider_status, "ACCEPTED");
  assert.equal(result.document.cufe, "CUFE-123");
});

test("refreshDocumentStatus recovers accepted provider by external reference without create", async () => {
  const harness = buildHarness();
  harness.provider.getDocumentStatus = async (command) => ({
    documentId: command.documentId,
    providerDocumentId: "FACTUCORE-EXISTING-1",
    providerStatus: "ACCEPTED",
    normalizedStatus: "ACCEPTED",
    providerStatusDetail: "accepted",
    prefix: "FKE",
    number: "1",
    fullNumber: "FKE-1",
    cufe: "CUFE-EXISTING-1",
    cude: null,
    acceptedAt: new Date("2026-08-27T01:00:00.000Z"),
    rejectedAt: null,
    metadata: {},
  });

  const result = await harness.service.refreshDocumentStatus(ids.tenant, ids.document);

  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(result.document.provider_document_id, "FACTUCORE-EXISTING-1");
  assert.equal(result.document.provider_status, "ACCEPTED");
  assert.equal(result.document.cufe, "CUFE-EXISTING-1");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(harness.provider.received.retryDocument.length, 0);
});

test("processDocument returns idempotent result when already accepted", async () => {
  const harness = buildHarness(
    buildState({
      status: "ACCEPTED",
      provider_document_id: "FAKE-123",
      provider_status: "ACCEPTED",
    }),
  );

  const result = await harness.service.processDocument(ids.tenant, ids.document);

  assert.equal(result.idempotent, true);
  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
});

test("processDocument throws on already processing document", async () => {
  const harness = buildHarness(
    buildState({
      status: "PROCESSING",
    }),
  );

  await assert.rejects(
    () => harness.service.processDocument(ids.tenant, ids.document),
    ElectronicDocumentAlreadyProcessingError,
  );
});

const buildNotFoundError = () => {
  const error = new ElectronicBillingProviderError("provider document not found", "FACTUCORE_VALIDATION") as ElectronicBillingProviderError & { httpStatus?: number };
  error.httpStatus = 404;
  return error;
};

test("retry restarts issuance before provider document creation", async () => {
  const harness = buildHarness(buildState({ status: "TECHNICAL_ERROR" }));
  harness.provider.getDocumentStatus = async () => {
    throw buildNotFoundError();
  };

  const result = await harness.service.retryDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "PROCESSING");
  assert.equal(harness.provider.received.issueInvoice.length, 1);
  assert.equal(harness.provider.received.retryDocument.length, 0);
});

test("retry uses provider recovery when provider document already exists", async () => {
  const harness = buildHarness(buildState({ status: "TECHNICAL_ERROR", provider_document_id: "FAKE-EXISTING" }));

  harness.provider.retryDocument = async (command) => {
    harness.provider.received.retryDocument.push(command);
    return {
      documentId: command.documentId,
      providerDocumentId: "FAKE-EXISTING",
      providerStatus: "PROCESSING",
      normalizedStatus: "PROCESSING",
      providerStatusDetail: "retry requested",
      prefix: null,
      number: null,
      fullNumber: null,
      cufe: null,
      cude: null,
      acceptedAt: null,
      rejectedAt: null,
      errorCode: null,
      errorMessage: null,
      metadata: {},
    };
  };

  const result = await harness.service.retryDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "PROCESSING");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(harness.provider.received.retryDocument.length, 1);
});

test("retry reconciles provider document found by external reference", async () => {
  const harness = buildHarness(buildState({ status: "TECHNICAL_ERROR" }));
  harness.provider.getDocumentStatus = async () => ({
    documentId: ids.document,
    providerDocumentId: "FAKE-FOUND",
    providerStatus: "PROCESSING",
    normalizedStatus: "PROCESSING",
    providerStatusDetail: "processing",
    prefix: null,
    number: null,
    fullNumber: null,
    cufe: null,
    cude: null,
    acceptedAt: null,
    rejectedAt: null,
    metadata: {},
  });

  const result = await harness.service.retryDocument(ids.tenant, ids.document);

  assert.equal(result.document.provider_document_id, "FAKE-FOUND");
  assert.equal(result.document.status, "PROCESSING");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(harness.provider.received.retryDocument.length, 0);
});

test("approved pre-provider recovery can restart, but ordinary rejection cannot", async () => {
  const recoverable = buildHarness(buildState({
    status: "REJECTED",
    last_error_code: "FACTUCORE_VALIDATION",
    last_error_message: "FactuCore resource not found",
  }));
  recoverable.provider.getDocumentStatus = async () => {
    throw buildNotFoundError();
  };
  await recoverable.service.recoverPreProviderDocument(ids.tenant, ids.document);
  assert.equal(recoverable.provider.received.issueInvoice.length, 1);

  const payloadCorrection = buildHarness(buildState({
    status: "REJECTED",
    last_error_code: "FACTUCORE_VALIDATION",
    last_error_message: "lines.0.unitCode must be one of the following values: UNIT, NIU, EA",
  }));
  payloadCorrection.provider.getDocumentStatus = async () => {
    throw buildNotFoundError();
  };
  await payloadCorrection.service.recoverPreProviderDocument(ids.tenant, ids.document);
  assert.equal(payloadCorrection.provider.received.issueInvoice.length, 1);

  const rejected = buildHarness(buildState({
    status: "REJECTED",
    last_error_code: "FACTUCORE_VALIDATION",
    last_error_message: "FactuCore rejected fiscal rule",
    provider_document_id: "FACTUCORE-DOCUMENT-1",
  }));
  await assert.rejects(() => rejected.service.retryDocument(ids.tenant, ids.document));
  assert.equal(rejected.provider.received.issueInvoice.length, 0);
  await assert.rejects(() => rejected.service.recoverPreProviderDocument(ids.tenant, ids.document));
});

test("retryDocument delegates correctable pre-provider rejection to issue flow", async () => {
  const harness = buildHarness(buildState({
    status: "REJECTED",
    last_error_code: "FACTUCORE_VALIDATION",
    last_error_message: "structured provider detail with changed wording",
  }));
  harness.provider.getDocumentStatus = async () => {
    throw buildNotFoundError();
  };

  const result = await harness.service.retryDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "PROCESSING");
  assert.equal(harness.provider.received.issueInvoice.length, 1);
  assert.equal(harness.provider.received.retryDocument.length, 0);
});

test("retryDocument reconciles found provider before any create for a correctable rejection", async () => {
  const harness = buildHarness(buildState({
    status: "REJECTED",
    last_error_code: "FACTUCORE_VALIDATION",
    last_error_message: "provider detail",
  }));
  harness.provider.getDocumentStatus = async () => ({
    documentId: ids.document,
    providerDocumentId: "FAKE-FOUND",
    providerStatus: "PROCESSING",
    normalizedStatus: "PROCESSING",
    providerStatusDetail: "processing",
    prefix: null,
    number: null,
    fullNumber: null,
    cufe: null,
    cude: null,
    acceptedAt: null,
    rejectedAt: null,
    metadata: {},
  });

  const result = await harness.service.retryDocument(ids.tenant, ids.document);

  assert.equal(result.document.provider_document_id, "FAKE-FOUND");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(harness.provider.received.retryDocument.length, 0);
});

test("retryDocument blocks unrelated rejected errors without provider calls", async () => {
  const harness = buildHarness(buildState({
    status: "REJECTED",
    last_error_code: "UNKNOWN_ERROR",
    last_error_message: "wording is not a recovery signal",
  }));

  await assert.rejects(() => harness.service.retryDocument(ids.tenant, ids.document));
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(harness.provider.received.retryDocument.length, 0);
  assert.equal(harness.provider.received.getDocumentStatus.length, 0);
});

test("technical provider exception stays technical error", async () => {
  const harness = buildHarness();
  harness.provider.issueInvoice = async () => {
    throw new Error("network failure");
  };

  const result = await harness.service.processDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "TECHNICAL_ERROR");
});

test("processing persists safe FactuCore failed-check paths", async () => {
  const harness = buildHarness();
  harness.provider.issueInvoice = async () => {
    throw new FactuCoreValidationError(
      "issue_invoice",
      400,
      "customer.cityName: Required; customer.departmentCode: Required",
      [
        { path: "customer.cityName", message: "Required" },
        { path: "customer.departmentCode", message: "Required" },
      ],
      "DIAN_READINESS_VALIDATION",
    );
  };

  const result = await harness.service.processDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "REJECTED");
  assert.equal(result.document.last_error_code, "FACTUCORE_VALIDATION");
  assert.match(result.document.last_error_message ?? "", /customer\.cityName: Required/);
  assert.match(result.document.last_error_message ?? "", /customer\.departmentCode: Required/);
  assert.doesNotMatch(result.document.last_error_message ?? "", /clientSecret|softwarePin|technicalKey/);
});

test("provider ID survives failure after create", async () => {
  const harness = buildHarness();
  const error = new Error("generate XML failed") as Error & { providerDocumentId?: string };
  error.providerDocumentId = "FAKE-CREATED";
  harness.provider.issueInvoice = async () => {
    throw error;
  };

  const result = await harness.service.processDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "TECHNICAL_ERROR");
  assert.equal(result.document.provider_document_id, "FAKE-CREATED");
});
