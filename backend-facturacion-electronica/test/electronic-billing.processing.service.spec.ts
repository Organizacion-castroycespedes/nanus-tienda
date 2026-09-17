import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectronicBillingProviderError,
  ElectronicBillingProcessingService,
  extractAuthoritativeQrPayload,
  ElectronicDocumentAlreadyProcessingError,
  FakeElectronicBillingProvider,
} from "../src/modules/electronic-billing";
import {
  FactuCoreAuthenticationError,
  FactuCoreValidationError,
} from "../src/modules/electronic-billing/providers/factucore/factucore.errors";

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
          standardItemId: "ARR-12",
          standardItemSchemeId: "999",
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

const buildHarness = (state = buildState(), advisoryLockAvailable = true) => {
  const clientCalls: string[] = [];
  const client = {
    query: async (text: string) => {
      clientCalls.push(text);
      return text.includes("pg_try_advisory_lock") ? { rows: [{ locked: advisoryLockAvailable }] } : { rows: [] };
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
    if ("processingStage" in updates) {
      mapped.processing_stage = updates.processingStage;
      delete mapped.processingStage;
    }
    if ("processingStageUpdatedAt" in updates) {
      mapped.processing_stage_updated_at = updates.processingStageUpdatedAt;
      delete mapped.processingStageUpdatedAt;
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
    recoverPreProviderCreateFailure: async (_tenantId: string, _id: string, externalReference: string) => {
      if (
        state.document.external_reference !== externalReference ||
        state.document.status !== "TECHNICAL_ERROR" ||
        state.document.processing_stage !== "PROVIDER_CREATE_INTENT" ||
        state.document.provider_document_id
      ) {
        return null;
      }
      state.document = {
        ...state.document,
        status: "PENDING",
        provider_status: null,
        provider_status_detail: null,
        last_status_check_at: null,
        processing_stage: "PRE_PROVIDER_CREATE",
        last_error_code: null,
        last_error_message: null,
      };
      return state.document.id;
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

test("extractAuthoritativeQrPayload reads namespaced QR and rejects conflicts", () => {
  const payload = "NumFac: SETP990000009\nCUFE: authoritative";
  assert.equal(
    extractAuthoritativeQrPayload(`<Invoice><sts:QRCode>${payload}</sts:QRCode></Invoice>`),
    payload,
  );
  assert.equal(
    extractAuthoritativeQrPayload(`<Invoice><a:QRCode>${payload}</a:QRCode><b:QRCode>${payload}</b:QRCode></Invoice>`),
    payload,
  );
  assert.equal(extractAuthoritativeQrPayload("<Invoice />"), null);
  assert.throws(
    () => extractAuthoritativeQrPayload("<Invoice><sts:QRCode>A</sts:QRCode><sts:QRCode>B</sts:QRCode></Invoice>"),
    /Conflicting authoritative QR values/,
  );
});

test("processDocument issues invoice and persists provider identity", async () => {
  const harness = buildHarness();

  const result = await harness.service.processDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "PROCESSING");
  assert.equal(result.document.provider_document_id, "FAKE-00000000-0000-0000-0000-000000000504");
  assert.equal(harness.provider.received.issueInvoice.length, 1);
  assert.equal(harness.provider.received.issueInvoice[0].lines[0].standardItemId, "ARR-12");
  assert.equal(harness.provider.received.issueInvoice[0].lines[0].standardItemSchemeId, "999");
});

test("processDocument rebuilds the canonical payment array from the durable billing snapshot", async () => {
  const payments = [
    { methodCode: "001", amount: "700.00", paymentMeansCode: "10", paymentMeansId: "1" },
    { methodCode: "003", amount: "490.00", paymentMeansCode: "49", paymentMeansId: "1" },
  ];
  const harness = buildHarness(buildState({
    metadata: {
      electronicBilling: {
        customer: {
          identification: { number: "900123456", typeCode: "31" },
          legalName: "Client SA",
        },
        payments,
      },
    },
  }));

  await harness.service.processDocument(ids.tenant, ids.document);

  assert.deepEqual(
    harness.provider.received.issueInvoice[0].payments?.map((payment) => [
      payment.amount,
      payment.paymentMeansCode,
      payment.paymentMeansId,
    ]),
    [
      ["700.00", "10", "1"],
      ["490.00", "49", "1"],
    ],
  );
});

test("initial accepted processing persists the authoritative QR from signed XML", async () => {
  const harness = buildHarness();
  const qrPayload = "NumFac: FKE-1\\nCUFE: authoritative-qr";
  harness.provider.issueInvoice = async () => ({
    documentId: ids.document,
    providerDocumentId: "FACTUCORE-ACCEPTED-1",
    providerStatus: "ACCEPTED",
    normalizedStatus: "ACCEPTED",
    providerStatusDetail: "accepted",
    prefix: "FKE",
    number: "1",
    fullNumber: "FKE-1",
    cufe: "CUFE-ACCEPTED-1",
    cude: null,
    acceptedAt: new Date("2026-08-27T01:00:00.000Z"),
    rejectedAt: null,
    metadata: {},
  });
  harness.provider.downloadAttachment = async () => ({
    documentId: ids.document,
    providerDocumentId: "FACTUCORE-ACCEPTED-1",
    attachmentType: "SIGNED_XML",
    providerAttachmentId: "ATT-1",
    content: Buffer.from(`<Invoice><sts:QRCode>${qrPayload}</sts:QRCode></Invoice>`),
    fileName: "signed.xml",
    mimeType: "application/xml",
    storageProvider: "fake",
    storageKey: null,
    checksum: null,
    sizeBytes: Buffer.byteLength(qrPayload),
    metadata: {},
  });

  const result = await harness.service.processDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(result.document.processing_stage, "COMPLETED");
  assert.equal(result.document.metadata.electronicBilling.qrPayload, qrPayload);
  assert.equal(harness.provider.received.downloadAttachment.length, 0);
});

test("accepted processing does not fabricate QR when signed XML has no QR", async () => {
  const harness = buildHarness();
  harness.provider.issueInvoice = async () => ({
    documentId: ids.document,
    providerDocumentId: "FACTUCORE-ACCEPTED-NO-QR",
    providerStatus: "ACCEPTED",
    normalizedStatus: "ACCEPTED",
    providerStatusDetail: "accepted",
    prefix: "FKE",
    number: "1",
    fullNumber: "FKE-1",
    cufe: "CUFE-ACCEPTED-NO-QR",
    cude: null,
    acceptedAt: new Date("2026-08-27T01:00:00.000Z"),
    rejectedAt: null,
    metadata: {},
  });
  harness.provider.downloadAttachment = async () => ({
    documentId: ids.document,
    providerDocumentId: "FACTUCORE-ACCEPTED-NO-QR",
    attachmentType: "SIGNED_XML",
    providerAttachmentId: "ATT-NO-QR",
    content: Buffer.from("<Invoice />"),
    fileName: "signed.xml",
    mimeType: "application/xml",
    storageProvider: "fake",
    storageKey: null,
    checksum: null,
    sizeBytes: 11,
    metadata: {},
  });

  const result = await harness.service.processDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(result.document.processing_stage, "COMPLETED");
  assert.equal(result.document.metadata.electronicBilling.qrPayload, undefined);
});

test("provider authentication failure remains technical and preserves HTTP evidence", async () => {
  const harness = buildHarness();
  harness.provider.issueInvoice = async () => {
    throw new FactuCoreAuthenticationError("create_invoice", 403);
  };

  const result = await harness.service.processDocument(ids.tenant, ids.document);

  assert.equal(result.document.status, "TECHNICAL_ERROR");
  assert.equal(result.document.processing_stage, "PROVIDER_CREATE_INTENT");
  assert.equal(result.document.provider_document_id, null);
  assert.equal(result.document.last_error_code, "FACTUCORE_AUTHENTICATION");
  assert.equal(result.events.at(-1)?.event_type, "TECHNICAL_ERROR");
  assert.equal(result.events.at(-1)?.http_status, 403);

  const retryability = await harness.service.evaluateRetryability(ids.tenant, ids.document);
  assert.equal(retryability.canRetry, false);
  assert.equal(retryability.canRecoverProviderCreateIntent, true);
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
     providerStatusCode: "100",
     providerStatusMessage: "Accepted by DIAN",
     trackingId: "TRACK-123",
     acceptedAt: new Date("2026-08-27T01:00:00.000Z"),
    rejectedAt: null,
    metadata: {},
  });

  const result = await harness.service.refreshDocumentStatus(ids.tenant, ids.document);

  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(result.document.provider_status, "ACCEPTED");
  assert.equal(result.document.cufe, "CUFE-123");
  assert.deepEqual(result.document.metadata.providerResponse, {
    code: "100",
    message: "Accepted by DIAN",
    trackingId: "TRACK-123",
  });
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

test("repeated accepted reconciliation preserves fiscal metadata without provider mutation", async () => {
  const harness = buildHarness(buildState({ status: "PROCESSING", provider_document_id: "FACTUCORE-EXISTING-1" }));
  let lookupCalls = 0;
  harness.provider.getDocumentStatus = async (command) => {
    lookupCalls += 1;
    return {
      documentId: command.documentId,
      providerDocumentId: "FACTUCORE-EXISTING-1",
      providerStatus: "ACCEPTED",
      normalizedStatus: "ACCEPTED",
      providerStatusDetail: "accepted",
      providerStatusCode: "100",
      providerStatusMessage: "Accepted by DIAN",
      trackingId: "TRACK-EXISTING-1",
      cufe: "CUFE-EXISTING-1",
      acceptedAt: new Date("2026-08-27T01:00:00.000Z"),
      rejectedAt: null,
      metadata: {},
    };
  };

  await harness.service.refreshDocumentStatus(ids.tenant, ids.document);
  const result = await harness.service.refreshDocumentStatus(ids.tenant, ids.document);

  assert.equal(lookupCalls, 2);
  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(result.document.cufe, "CUFE-EXISTING-1");
  assert.equal(result.document.metadata.providerResponse.code, "100");
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

test("retry fails closed when provider lookup is not found without pre-provider proof", async () => {
  const harness = buildHarness(buildState({ status: "TECHNICAL_ERROR" }));
  harness.provider.getDocumentStatus = async () => {
    throw buildNotFoundError();
  };

  const result = await harness.service.retryDocument(ids.tenant, ids.document);
  assert.equal(result.document.status, "TECHNICAL_ERROR");
  assert.match(result.document.last_error_message ?? "", /Provider mutation evidence is ambiguous/);
  assert.equal(harness.provider.received.issueInvoice.length, 0);
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

test("stale processing reconciles an accepted provider without transmission", async () => {
  const harness = buildHarness(buildState({
    status: "PROCESSING",
    provider_document_id: "FAKE-ACCEPTED",
    provider_status: "PROCESSING",
  }));
  harness.provider.getDocumentStatus = async (command) => ({
    documentId: command.documentId,
    providerDocumentId: "FAKE-ACCEPTED",
    providerStatus: "ACCEPTED",
    normalizedStatus: "ACCEPTED",
    providerStatusDetail: "accepted",
    prefix: "FKE",
    number: "2",
    fullNumber: "FKE-2",
    cufe: "CUFE-ACCEPTED",
    cude: null,
    acceptedAt: new Date("2026-08-27T02:00:00.000Z"),
    rejectedAt: null,
    metadata: {},
  });

  const result = await harness.service.refreshDocumentStatus(ids.tenant, ids.document);

  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(harness.provider.received.retryDocument.length, 0);
});

test("stale processing reconciles a final rejected provider without retry", async () => {
  const harness = buildHarness(buildState({
    status: "PROCESSING",
    provider_document_id: "FAKE-REJECTED",
    provider_status: "PROCESSING",
  }));
  harness.provider.getDocumentStatus = async (command) => ({
    documentId: command.documentId,
    providerDocumentId: "FAKE-REJECTED",
    providerStatus: "REJECTED",
    normalizedStatus: "REJECTED",
    providerStatusDetail: "final fiscal rejection",
    prefix: "FKE",
    number: "3",
    fullNumber: "FKE-3",
    cufe: null,
    cude: null,
    acceptedAt: null,
    rejectedAt: new Date("2026-08-27T02:00:00.000Z"),
    metadata: {},
  });

  const result = await harness.service.refreshDocumentStatus(ids.tenant, ids.document);

  assert.equal(result.document.status, "REJECTED");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(harness.provider.received.retryDocument.length, 0);
});

test("stale processing recovers a provider link by external reference", async () => {
  const harness = buildHarness(buildState({
    status: "PROCESSING",
    provider_document_id: null,
    provider_status: null,
  }));
  harness.provider.getDocumentStatus = async (command) => ({
    documentId: command.documentId,
    providerDocumentId: "FAKE-RECOVERED",
    providerStatus: "PROCESSING",
    normalizedStatus: "PROCESSING",
    providerStatusDetail: "prepared",
    prefix: "FKE",
    number: "4",
    fullNumber: "FKE-4",
    cufe: null,
    cude: null,
    acceptedAt: null,
    rejectedAt: null,
    metadata: {},
  });

  const result = await harness.service.refreshDocumentStatus(ids.tenant, ids.document);

  assert.equal(result.document.provider_document_id, "FAKE-RECOVERED");
  assert.equal(result.document.status, "PROCESSING");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
});

test("stale processing with no provider document fails closed without creating", async () => {
  const harness = buildHarness(buildState({
    status: "PROCESSING",
    provider_document_id: null,
  }));
  harness.provider.getDocumentStatus = async () => {
    throw buildNotFoundError();
  };

  await assert.rejects(() => harness.service.refreshDocumentStatus(ids.tenant, ids.document));
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(harness.provider.received.retryDocument.length, 0);
});

test("stale provider response cannot regress an accepted document", async () => {
  const harness = buildHarness(buildState({
    status: "ACCEPTED",
    provider_document_id: "FAKE-ACCEPTED",
    provider_status: "ACCEPTED",
    cufe: "CUFE-IMMUTABLE",
  }));
  harness.provider.getDocumentStatus = async (command) => ({
    documentId: command.documentId,
    providerDocumentId: "FAKE-ACCEPTED",
    providerStatus: "PROCESSING",
    normalizedStatus: "PROCESSING",
    providerStatusDetail: "stale response",
    prefix: "FKE",
    number: "5",
    fullNumber: "FKE-5",
    cufe: null,
    cude: null,
    acceptedAt: null,
    rejectedAt: null,
    metadata: {},
  });

  const result = await harness.service.refreshDocumentStatus(ids.tenant, ids.document);

  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(result.document.cufe, "CUFE-IMMUTABLE");
});

test("crash after provider create recovers by external reference without creating twice", async () => {
  const harness = buildHarness();
  const originalPersist = (harness.service as unknown as { persistProviderResult: unknown }).persistProviderResult;
  let persistAttempts = 0;
  (harness.service as unknown as { persistProviderResult: (...args: unknown[]) => Promise<unknown> }).persistProviderResult = async (...args) => {
    persistAttempts += 1;
    if (persistAttempts === 1) {
      throw new Error("simulated crash after provider create");
    }
    return (originalPersist as (...persistArgs: unknown[]) => Promise<unknown>).apply(harness.service, args);
  };
  harness.provider.getDocumentStatus = async (command) => ({
    documentId: command.documentId,
    providerDocumentId: "FAKE-CREATED",
    providerStatus: "PROCESSING",
    normalizedStatus: "PROCESSING",
    providerStatusDetail: "existing provider document",
    prefix: "FKE",
    number: "6",
    fullNumber: "FKE-6",
    cufe: null,
    cude: null,
    acceptedAt: null,
    rejectedAt: null,
    metadata: {},
  });

  const failed = await harness.service.processDocument(ids.tenant, ids.document);
  assert.equal(failed.document.status, "TECHNICAL_ERROR");
  const recovered = await harness.service.refreshDocumentStatus(ids.tenant, ids.document);

  assert.equal(recovered.document.provider_document_id, "FAKE-CREATED");
  assert.equal(harness.provider.received.issueInvoice.length, 1);
});

test("persistent provider mock recovers a create timeout without duplicating the provider document", async () => {
  const harness = buildHarness(buildState({ status: "PENDING" }));
  let createCalls = 0;
  const providerState = {
    providerDocumentId: "FAKE-TIMEOUT-PERSISTED",
    providerStatus: "PROCESSING",
  };
  harness.provider.issueInvoice = async () => {
    createCalls += 1;
    throw new Error("provider create timeout after persistence");
  };
  harness.provider.getDocumentStatus = async (command) => ({
    documentId: command.documentId,
    providerDocumentId: providerState.providerDocumentId,
    providerStatus: providerState.providerStatus,
    normalizedStatus: "PROCESSING",
    providerStatusDetail: "recovered by external reference",
    prefix: "FKE",
    number: "7",
    fullNumber: "FKE-7",
    cufe: null,
    cude: null,
    acceptedAt: null,
    rejectedAt: null,
    metadata: {},
  });

  const failed = await harness.service.processDocument(ids.tenant, ids.document);
  assert.equal(failed.document.status, "TECHNICAL_ERROR");
  const recovered = await harness.service.refreshDocumentStatus(ids.tenant, ids.document);

  assert.equal(recovered.document.provider_document_id, providerState.providerDocumentId);
  assert.equal(recovered.document.status, "PROCESSING");
  assert.equal(createCalls, 1);
});

test("persistent provider mock keeps an unresolved create timeout fail-closed", async () => {
  const harness = buildHarness(buildState({
    status: "TECHNICAL_ERROR",
    last_error_code: "NETWORK_TIMEOUT",
  }));
  let providerExists = false;
  harness.provider.getDocumentStatus = async () => {
    if (!providerExists) {
      throw buildNotFoundError();
    }

    return {
      documentId: ids.document,
      providerDocumentId: "FAKE-UNEXPECTED",
      providerStatus: "PROCESSING",
      normalizedStatus: "PROCESSING",
      providerStatusDetail: "unexpected provider state",
      metadata: {},
    };
  };
  harness.provider.issueInvoice = async () => {
    providerExists = true;
    throw new Error("provider create timeout");
  };

  const result = await harness.service.retryDocument(ids.tenant, ids.document);
  assert.equal(result.document.status, "TECHNICAL_ERROR");
  assert.match(result.document.last_error_message ?? "", /Provider mutation evidence is ambiguous/);
  assert.equal(providerExists, false);
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(harness.provider.received.retryDocument.length, 0);
});

test("confirmed provider absence resets the same document for background pickup without provider create", async () => {
  const harness = buildHarness(buildState({
    status: "TECHNICAL_ERROR",
    last_error_code: "FACTUCORE_NETWORK",
    processing_stage: "PROVIDER_CREATE_INTENT",
  }));
  harness.provider.getDocumentStatus = async () => {
    throw buildNotFoundError();
  };

  const result = await harness.service.recoverAfterConfirmedProviderAbsence(ids.tenant, ids.document);

  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(harness.provider.received.retryDocument.length, 0);
  assert.equal(result.document.id, ids.document);
  assert.equal(result.document.status, "PENDING");
  assert.equal(result.document.processing_stage, "PRE_PROVIDER_CREATE");
  assert.equal(result.document.external_reference, "SALE-501");
  assert.equal(result.events.at(-1)?.event_type, "PROVIDER_CREATE_INTENT_RECOVERED");
  assert.equal(result.events.at(-1)?.metadata.reconciliation, "NOT_FOUND");
});

test("provider-create-intent recovery rejects a different stage and an active lease", async () => {
  const wrongStage = buildHarness(buildState({
    status: "TECHNICAL_ERROR",
    last_error_code: "FACTUCORE_NETWORK",
    processing_stage: "TRANSMISSION_INTENT",
  }));
  wrongStage.provider.getDocumentStatus = async () => { throw buildNotFoundError(); };
  await assert.rejects(
    () => wrongStage.service.recoverAfterConfirmedProviderAbsence(ids.tenant, ids.document),
    /pre-provider technical error/,
  );

  const activeLease = buildHarness(buildState({
    status: "TECHNICAL_ERROR",
    last_error_code: "FACTUCORE_NETWORK",
    processing_stage: "PROVIDER_CREATE_INTENT",
    last_status_check_at: new Date(Date.now() + 86_400_000),
  }), false);
  activeLease.provider.getDocumentStatus = async () => { throw buildNotFoundError(); };
  await assert.rejects(
    () => activeLease.service.recoverAfterConfirmedProviderAbsence(ids.tenant, ids.document),
    ElectronicDocumentAlreadyProcessingError,
  );
  assert.equal(activeLease.provider.received.getDocumentStatus.length, 0);
});

test("provider-create-intent recovery ignores a historical manual-review deferral", async () => {
  const harness = buildHarness(buildState({
    status: "TECHNICAL_ERROR",
    last_error_code: "FACTUCORE_NETWORK",
    processing_stage: "PROVIDER_CREATE_INTENT",
    last_status_check_at: new Date(Date.now() + 86_400_000),
  }));
  harness.provider.getDocumentStatus = async () => { throw buildNotFoundError(); };

  const result = await harness.service.recoverAfterConfirmedProviderAbsence(ids.tenant, ids.document);

  assert.equal(result.document.status, "PENDING");
  assert.equal(result.document.processing_stage, "PRE_PROVIDER_CREATE");
});

test("retryability exposes dedicated provider-create-intent recovery from backend state and history", async () => {
  const state = buildState({
    status: "TECHNICAL_ERROR",
    last_error_code: "ElectronicDocumentNotProcessableError",
    processing_stage: "PROVIDER_CREATE_INTENT",
    provider_document_id: null,
  });
  state.events.push({
    ...state.events[0],
    id: "00000000-0000-0000-0000-000000000599",
    event_type: "TECHNICAL_ERROR",
    status: "TECHNICAL_ERROR",
    error_code: "FACTUCORE_NETWORK",
  });
  const harness = buildHarness(state);

  const decision = await harness.service.evaluateRetryability(ids.tenant, ids.document);

  assert.equal(decision.canRetry, false);
  assert.equal(decision.canRecoverProviderCreateIntent, true);
  assert.equal(decision.requiredAction, "RECONCILE_PROVIDER");
});

test("provider-create-intent recovery links an existing provider without creating another", async () => {
  const harness = buildHarness(buildState({
    status: "TECHNICAL_ERROR",
    last_error_code: "FACTUCORE_NETWORK",
    processing_stage: "PROVIDER_CREATE_INTENT",
  }));
  harness.provider.getDocumentStatus = async () => ({
    documentId: ids.document,
    providerDocumentId: "FACTUCORE-EXISTING",
    providerStatus: "ACCEPTED",
    normalizedStatus: "ACCEPTED",
    providerStatusDetail: "accepted",
    prefix: "FKE",
    number: "1",
    fullNumber: "FKE-1",
    cufe: "CUFE-EXISTING",
    cude: null,
    acceptedAt: new Date("2026-08-27T01:00:00.000Z"),
    rejectedAt: null,
    metadata: {},
  });

  const result = await harness.service.recoverAfterConfirmedProviderAbsence(ids.tenant, ids.document);

  assert.equal(result.document.provider_document_id, "FACTUCORE-EXISTING");
  assert.equal(result.document.status, "ACCEPTED");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
});

test("provider-create-intent recovery resumes VALIDATED_INTERNAL provider without create", async () => {
  const harness = buildHarness(buildState({
    status: "TECHNICAL_ERROR",
    last_error_code: "FACTUCORE_TIMEOUT",
    processing_stage: "PROVIDER_CREATE_INTENT",
  }));
  const provider = harness.provider as any;
  let statusLookupCount = 0;
  let resumedProviderId: string | null = null;
  provider.getDocumentStatus = async () => {
    statusLookupCount += 1;
    return {
      documentId: ids.document,
      providerDocumentId: "FACTUCORE-VALIDATED-INTERNAL",
      providerStatus: "VALIDATED_INTERNAL",
      normalizedStatus: "PROCESSING",
      providerStatusDetail: "validated internally",
      prefix: "FKE",
      number: "1",
      fullNumber: "FKE-1",
      cufe: null,
      cude: null,
      acceptedAt: null,
      rejectedAt: null,
      metadata: {},
    };
  };
  provider.getDocument = async () => ({
    documentId: ids.document,
    providerDocumentId: "FACTUCORE-VALIDATED-INTERNAL",
    providerStatus: "VALIDATED_INTERNAL",
    normalizedStatus: "PROCESSING",
    providerStatusDetail: "validated internally",
    prefix: "FKE",
    number: "1",
    fullNumber: "FKE-1",
    cufe: null,
    cude: null,
    acceptedAt: null,
    rejectedAt: null,
    metadata: {},
  });
  provider.resumeInvoice = async (_command: unknown, providerDocumentId: string) => {
    resumedProviderId = providerDocumentId;
    return {
      documentId: ids.document,
      providerDocumentId,
      providerStatus: "ACCEPTED",
      normalizedStatus: "ACCEPTED",
      providerStatusDetail: "accepted",
      prefix: "FKE",
      number: "1",
      fullNumber: "FKE-1",
      cufe: "CUFE-RESUMED",
      cude: null,
      acceptedAt: new Date("2026-08-27T01:00:00.000Z"),
      rejectedAt: null,
      metadata: {},
    };
  };

  const result = await harness.service.recoverAfterConfirmedProviderAbsence(ids.tenant, ids.document);

  assert.equal(statusLookupCount, 1);
  assert.equal(resumedProviderId, "FACTUCORE-VALIDATED-INTERNAL");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(result.document.provider_document_id, "FACTUCORE-VALIDATED-INTERNAL");
  assert.equal(result.document.status, "ACCEPTED");
});

test("smart recovery resumes an existing SIGNED provider document without absence recovery or create", async () => {
  const harness = buildHarness(buildState({
    status: "TECHNICAL_ERROR",
    processing_stage: "RECONCILIATION_REQUIRED",
    provider_document_id: "FACTUCORE-SIGNED",
    last_error_code: "FACTUCORE_NETWORK",
  }));
  const provider = harness.provider as any;
  let resumedProviderId: string | null = null;
  provider.getDocument = async () => ({
    documentId: ids.document,
    providerDocumentId: "FACTUCORE-SIGNED",
    providerStatus: "SIGNED",
    normalizedStatus: "PROCESSING",
    providerStatusDetail: "signed",
    prefix: "FKE",
    number: "2",
    fullNumber: "FKE-2",
    cufe: null,
    cude: null,
    acceptedAt: null,
    rejectedAt: null,
    metadata: {},
  });
  provider.resumeInvoice = async (_command: unknown, providerDocumentId: string) => {
    resumedProviderId = providerDocumentId;
    return {
      documentId: ids.document,
      providerDocumentId,
      providerStatus: "ACCEPTED",
      normalizedStatus: "ACCEPTED",
      providerStatusDetail: "accepted",
      prefix: "FKE",
      number: "2",
      fullNumber: "FKE-2",
      cufe: "CUFE-SIGNED-RESUMED",
      cude: null,
      acceptedAt: new Date("2026-09-16T00:00:00.000Z"),
      rejectedAt: null,
      metadata: {},
    };
  };

  const result = await harness.service.recoverProcessing(ids.tenant, ids.document);

  assert.equal(resumedProviderId, "FACTUCORE-SIGNED");
  assert.equal(harness.provider.received.issueInvoice.length, 0);
  assert.equal(result.recovery, "EXISTING_PROVIDER_RESUMED");
  assert.equal(result.resultCode, "EXISTING_PROVIDER_RECONCILED");
  assert.equal(result.document.provider_document_id, "FACTUCORE-SIGNED");
  assert.equal(result.document.status, "ACCEPTED");
});
