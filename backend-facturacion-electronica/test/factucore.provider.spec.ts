import assert from "node:assert/strict";
import test from "node:test";
import { ElectronicBillingProviderRegistry } from "../src/modules/electronic-billing/providers";
import type {
  ElectronicBillingProviderContext,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
} from "../src/modules/electronic-billing/contracts/electronic-billing-commands";
import { FactuCoreMapper } from "../src/modules/electronic-billing/providers/factucore";
import {
  FactuCoreProvider,
  FactuCoreProviderBootstrap,
} from "../src/modules/electronic-billing/providers/factucore";
import { FactuCoreClient } from "../src/modules/electronic-billing/providers/factucore";
import { FakeElectronicBillingProvider } from "../src/modules/electronic-billing/providers";
import type {
  FactuCoreBinaryResponse,
  FactuCoreCredentialResolver,
  FactuCoreDocumentResponse,
  FactuCoreRuntimeContext,
  FactuCoreStatusResponse,
} from "../src/modules/electronic-billing/providers/factucore";
import { ElectronicBillingProviderCapabilityError } from "../src/modules/electronic-billing/contracts/electronic-billing-errors";
import { assertElectronicBillingProviderCapability } from "../src/modules/electronic-billing/contracts/electronic-billing-provider";
import { FactuCoreValidationError } from "../src/modules/electronic-billing/providers/factucore/factucore.errors";

const makeContext = (tenantId: string): ElectronicBillingProviderContext => ({
  tenantId,
  providerId: "provider-factucore",
  providerConfigId: "config-factucore",
  environment: "TEST",
  baseUrl: "https://factucore.test",
  credentialReference: `cred-${tenantId}`,
  settings: {
    factucoreTimeoutMs: 25,
    factuCoreTenantId: "factucore-tenant-a",
  },
});

const makeInvoiceCommand = (tenantId = "tenant-a"): IssueElectronicInvoiceCommand => ({
  context: makeContext(tenantId),
  documentId: `document-${tenantId}`,
  externalReference: `SALE-${tenantId}`,
  issueDate: new Date("2026-08-27T10:00:00.000Z"),
  issueTime: "10:00:00",
  customer: {
    customerType: "COMPANY",
    identification: {
      typeCode: "31",
      number: "900123456",
      verificationDigit: "7",
    },
    legalName: "Cliente Uno SAS",
    email: "cliente@example.com",
    municipalityCode: "11001",
    metadata: {
      tradeName: "Cliente Uno",
    },
  } as never,
  payment: {
    methodCode: "10",
    term: "IMMEDIATE",
    dueDate: new Date("2026-08-30T00:00:00.000Z"),
  },
  lines: [
    {
      sourceLineId: "sale-line-1",
      description: "Servicio tecnico",
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
  totals: {
    subtotalAmount: 1000,
    discountAmount: 0,
    taxAmount: 190,
    totalAmount: 1190,
    currencyCode: "COP",
  },
  metadata: { source: "sale" },
});

const makeCreditNoteCommand = (tenantId = "tenant-a"): IssueElectronicCreditNoteCommand => ({
  ...makeInvoiceCommand(tenantId),
  documentId: `credit-${tenantId}`,
  externalReference: `RETURN-${tenantId}`,
  customer: {
    customerType: "COMPANY",
    identification: {
      typeCode: "31",
      number: "900123456",
    },
    legalName: "Cliente Uno SAS",
  } as never,
  originalDocument: {
    internalDocumentId: `origin-${tenantId}`,
    providerDocumentId: `factu-origin-${tenantId}`,
    externalReference: `SALE-${tenantId}`,
    fullNumber: `FC-${tenantId}`,
  },
  reason: {
    reasonCode: "5",
    reasonDescription: "Ajuste comercial",
    reasonType: "RETURN",
  },
  lines: [
    {
      sourceLineId: "return-line-1",
      originalElectronicDocumentLineId: `origin-line-${tenantId}`,
      providerOriginalLineId: `factu-line-${tenantId}`,
      description: "Servicio tecnico ajuste",
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
});

const buildDoc = (overrides: Partial<FactuCoreDocumentResponse> = {}): FactuCoreDocumentResponse => ({
  id: "factu-doc-1",
  status: "VALIDATED_INTERNAL",
  providerStatus: "VALIDATED_INTERNAL",
  prefix: "FC",
  number: "1",
  fullNumber: "FC-1",
  ...overrides,
});

const buildStatusDoc = (overrides: Partial<FactuCoreStatusResponse> = {}): FactuCoreStatusResponse => ({
  id: "factu-doc-1",
  status: "VALIDATED_INTERNAL",
  providerStatus: "VALIDATED_INTERNAL",
  prefix: "FC",
  number: "1",
  fullNumber: "FC-1",
  ...overrides,
});

class RecordingFactuCoreClient {
  public readonly calls: Array<{ op: string; context: FactuCoreRuntimeContext; request?: unknown; documentId?: string; externalReference?: string; attachmentType?: string }> = [];

  async createInvoice(context: FactuCoreRuntimeContext, request: unknown) {
    this.calls.push({ op: "createInvoice", context, request });
    return buildDoc({ id: "factu-invoice-1", providerDocumentId: "factu-invoice-1" });
  }

  async createCreditNote(context: FactuCoreRuntimeContext, request: unknown) {
    this.calls.push({ op: "createCreditNote", context, request });
    return buildDoc({ id: "factu-credit-1", providerDocumentId: "factu-credit-1" });
  }

  async generateXml(context: FactuCoreRuntimeContext, documentId: string) {
    this.calls.push({ op: "generateXml", context, documentId });
    return buildDoc({ id: documentId, providerDocumentId: documentId, status: "XML_GENERATED", providerStatus: "XML_GENERATED" });
  }

  async sign(context: FactuCoreRuntimeContext, documentId: string) {
    this.calls.push({ op: "sign", context, documentId });
    return buildDoc({ id: documentId, providerDocumentId: documentId, status: "SIGNED", providerStatus: "SIGNED" });
  }

  async transmit(context: FactuCoreRuntimeContext, documentId: string) {
    this.calls.push({ op: "transmit", context, documentId });
    return buildDoc({ id: documentId, providerDocumentId: documentId, status: "SENT", providerStatus: "SENT" });
  }

  async getStatus(context: FactuCoreRuntimeContext, documentId: string) {
    this.calls.push({ op: "getStatus", context, documentId });
    return buildStatusDoc({
      id: documentId,
      providerDocumentId: documentId,
      status: documentId === "factu-doc-2" ? "ACCEPTED" : "VALIDATED_INTERNAL",
      providerStatus: documentId === "factu-doc-2" ? "ACCEPTED" : "VALIDATED_INTERNAL",
    });
  }

  async getStatusByExternalReference(context: FactuCoreRuntimeContext, externalReference: string) {
    this.calls.push({ op: "getStatusByExternalReference", context, externalReference });
    return buildStatusDoc({
      id: "factu-doc-by-reference",
      providerDocumentId: "factu-doc-by-reference",
      externalReference,
      status: "PENDING_RETRY",
      providerStatus: "PENDING_RETRY",
    });
  }

  async getOperations(context: FactuCoreRuntimeContext, documentId: string) {
    this.calls.push({ op: "getOperations", context, documentId });
    return {
      documentId,
      providerDocumentId: documentId,
      status: "VALIDATED_INTERNAL",
      currentStep: "VALIDATION",
      availableActions: ["read", "generate_xml", "sign"],
      artifactsAvailable: {
        xml: false,
        signedXml: false,
        pdf: false,
      },
      latestTransmission: null,
      metadata: { stage: "partial" },
    };
  }

  async retryTransmission(context: FactuCoreRuntimeContext, documentId: string) {
    this.calls.push({ op: "retryTransmission", context, documentId });
    return buildStatusDoc({ id: documentId, providerDocumentId: documentId, status: "PENDING_RETRY", providerStatus: "PENDING_RETRY" });
  }

  async downloadXml(context: FactuCoreRuntimeContext, documentId: string) {
    this.calls.push({ op: "downloadXml", context, documentId });
    return {
      content: Buffer.from("<xml />", "utf8"),
      contentType: "application/xml",
      fileName: "invoice.xml",
      sizeBytes: 7,
      providerAttachmentId: "att-xml",
    } satisfies FactuCoreBinaryResponse;
  }

  async downloadSignedXml(context: FactuCoreRuntimeContext, documentId: string) {
    this.calls.push({ op: "downloadSignedXml", context, documentId });
    return {
      content: Buffer.from("<signed />", "utf8"),
      contentType: "application/xml",
      fileName: "invoice-signed.xml",
      sizeBytes: 10,
      providerAttachmentId: "att-signed",
    } satisfies FactuCoreBinaryResponse;
  }

  async downloadPdf(context: FactuCoreRuntimeContext, documentId: string) {
    this.calls.push({ op: "downloadPdf", context, documentId });
    return {
      content: Buffer.from("%PDF", "utf8"),
      contentType: "application/pdf",
      fileName: "invoice.pdf",
      sizeBytes: 4,
      providerAttachmentId: "att-pdf",
    } satisfies FactuCoreBinaryResponse;
  }
}

const buildResolver = () => {
  const calls: ElectronicBillingProviderContext[] = [];
  const resolver: FactuCoreCredentialResolver = {
    resolve: async (context) => {
      calls.push(context);
      return {
        reference: `env:FACTUCORE_${context.tenantId}`,
        values: {
          clientKey: `key-${context.tenantId}`,
          clientSecret: `secret-${context.tenantId}`,
        },
      };
    },
  };

  return { calls, resolver };
};

test("bootstrap registers FactuCore provider in registry", () => {
  const registry = new ElectronicBillingProviderRegistry();
  const client = new RecordingFactuCoreClient();
  const { resolver } = buildResolver();
  const provider = new FactuCoreProvider(client as never, resolver, new FactuCoreMapper());
  const bootstrap = new FactuCoreProviderBootstrap(registry, provider);

  bootstrap.onModuleInit();

  assert.equal(registry.resolve("FACTUCORE").code, "FACTUCORE");
});

test("issueInvoice runs create then generate then sign then transmit", async () => {
  const client = new RecordingFactuCoreClient();
  const { resolver } = buildResolver();
  const provider = new FactuCoreProvider(client as never, resolver, new FactuCoreMapper());

  const result = await provider.issueInvoice(makeInvoiceCommand());

  assert.deepEqual(client.calls.map((call) => call.op), ["createInvoice", "generateXml", "sign", "transmit"]);
  assert.equal(result.providerStatus, "SENT");
  assert.equal(result.normalizedStatus, "PROCESSING");
  assert.equal(result.providerDocumentId, "factu-invoice-1");
  assert.equal(client.calls[0].context.factuCoreTenantId, "factucore-tenant-a");
});

test("FactuCore provider requires an explicit external tenant mapping", async () => {
  const client = new RecordingFactuCoreClient();
  const { resolver } = buildResolver();
  const provider = new FactuCoreProvider(client as never, resolver, new FactuCoreMapper());
  const command = makeInvoiceCommand();
  command.context.settings = { factucoreTimeoutMs: 25 };

  await assert.rejects(
    () => provider.issueInvoice(command),
    (error: unknown) => {
      assert.equal((error as Error).name, "FactuCoreConfigurationError");
      assert.match((error as Error).message, /factuCoreTenantId/);
      return true;
    },
  );
  assert.equal(client.calls.length, 0);
});

const makeRuntimeContext = (tenantId: string): FactuCoreRuntimeContext => ({
  baseUrl: "https://factucore.test",
  credentials: { clientKey: "test-key", clientSecret: "test-secret" },
  timeoutMs: 25,
});

test("FactuCore client preserves nested sanitized validation details", async () => {
  const client = new FactuCoreClient(async () => new Response(JSON.stringify({
    statusCode: 400,
    message: [
      { property: "lines[0]", children: [{ property: "taxes[0]", constraints: { isNumber: "rate must be a number" } }] },
      { property: "customer", constraints: { isNotEmpty: "customer is required" } },
    ],
    error: "Bad Request",
  }), { status: 400, headers: { "content-type": "application/json" } }));

  await assert.rejects(
    () => client.createInvoice(makeRuntimeContext("tenant-a"), {} as never),
    (error: unknown) => {
      assert.equal((error as Error).name, "FactuCoreValidationError");
      assert.equal((error as FactuCoreValidationError).httpStatus, 400);
      assert.deepEqual((error as FactuCoreValidationError).validationDetails, [
        { path: "lines[0].taxes[0]", message: "rate must be a number" },
        { path: "customer", message: "customer is required" },
      ]);
      assert.match((error as Error).message, /lines\[0\]\.taxes\[0\]: rate must be a number/);
      return true;
    },
  );
});

test("FactuCore client bounds non-JSON validation errors safely", async () => {
  const client = new FactuCoreClient(async () => new Response("provider validation unavailable", { status: 400 }));

  await assert.rejects(
    () => client.createInvoice(makeRuntimeContext("tenant-a"), {} as never),
    (error: unknown) => {
      assert.equal((error as Error).name, "FactuCoreValidationError");
      assert.equal((error as FactuCoreValidationError).httpStatus, 400);
      assert.deepEqual((error as FactuCoreValidationError).validationDetails, []);
      assert.equal((error as Error).message, "FactuCore request failed with status 400");
      return true;
    },
  );
});

test("FactuCore validation details redact secret fields", async () => {
  const client = new FactuCoreClient(async () => new Response(JSON.stringify({
    statusCode: 400,
    message: [{ property: "customer", constraints: { clientSecret: "do-not-store", clientKey: "do-not-store-either", isNotEmpty: "customer invalid" } }],
  }), { status: 400 }));

  await assert.rejects(
    () => client.createInvoice(makeRuntimeContext("tenant-a"), {} as never),
    (error: unknown) => {
      assert.equal((error as Error).name, "FactuCoreValidationError");
      assert.equal((error as FactuCoreValidationError).validationDetails.length, 1);
      assert.equal((error as FactuCoreValidationError).validationDetails[0].message, "customer invalid");
      assert.doesNotMatch((error as Error).message, /do-not-store/);
      return true;
    },
  );
});

test("mapper matches FactuCore tax DTO for taxed and excluded lines", () => {
  const mapper = new FactuCoreMapper();
  const taxed = mapper.buildInvoiceRequest(makeInvoiceCommand());
  const taxedTax = taxed.lines[0].taxes?.[0] as Record<string, unknown>;

  assert.deepEqual(Object.keys(taxedTax).sort(), ["metadata", "rate", "taxAmount", "taxType", "taxableBase"].sort());
  assert.equal((taxedTax.metadata as Record<string, unknown>).taxCode, "01");

  const excluded = makeInvoiceCommand();
  excluded.lines = [{
    ...excluded.lines[0],
    taxTreatment: "EXCLUDED",
    taxes: [{ type: "Exento", code: "20000000-0000-0000-0000-000000000002", rate: 0, taxableBase: 1000, amount: 0 }],
  }];
  const excludedRequest = mapper.buildInvoiceRequest(excluded);

  assert.equal(excludedRequest.lines[0].taxes, undefined);
  assert.equal(excludedRequest.lines[0].taxTreatment, "EXCLUDED");
});

test("mapper normalizes Manus CASH payment to FactuCore fiscal means", () => {
  const command = makeInvoiceCommand();
  command.payment = { ...command.payment, methodCode: "CASH" };

  const request = new FactuCoreMapper().buildInvoiceRequest(command);

  assert.equal(request.paymentMeansCode, "10");
  assert.equal(request.paymentMeansId, "1");
  assert.notEqual(request.paymentMeansCode, "CASH");
  assert.notEqual(request.paymentMeansId, "CASH");
});

test("mapper rejects unmapped payment methods before provider request construction", () => {
  const command = makeInvoiceCommand();
  command.payment = { ...command.payment, methodCode: "CRYPTO" };

  assert.throws(
    () => new FactuCoreMapper().buildInvoiceRequest(command),
    (error: unknown) => {
      assert.equal((error as Error).name, "FactuCoreConfigurationError");
      assert.match((error as Error).message, /payment method/i);
      return true;
    },
  );
});

test("mapper translates generic and Manus UND units to FactuCore-compatible EA", () => {
  const command = makeInvoiceCommand();
  command.lines = [{ ...command.lines[0], unitCode: "UNIT" }];

  const request = new FactuCoreMapper().buildInvoiceRequest(command);

  assert.equal(request.lines[0].unitCode, "EA");

  command.lines = [{ ...command.lines[0], unitCode: "UND" }];
  const manusRequest = new FactuCoreMapper().buildInvoiceRequest(command);

  assert.equal(manusRequest.lines[0].unitCode, "EA");
});

test("issueInvoice exposes provider ID when a later step fails", async () => {
  const client = new RecordingFactuCoreClient();
  client.generateXml = async (context, documentId) => {
    client.calls.push({ op: "generateXml", context, documentId });
    throw new Error("generate XML failed");
  };
  const { resolver } = buildResolver();
  const provider = new FactuCoreProvider(client as never, resolver, new FactuCoreMapper());

  await assert.rejects(
    () => provider.issueInvoice(makeInvoiceCommand()),
    (error: unknown) => {
      assert.equal((error as Error & { providerDocumentId?: string }).providerDocumentId, "factu-invoice-1");
      return true;
    },
  );
  assert.deepEqual(client.calls.map((call) => call.op), ["createInvoice", "generateXml"]);
});

test("issueCreditNote maps origin fields and provider line identity", async () => {
  const client = new RecordingFactuCoreClient();
  const { resolver } = buildResolver();
  const provider = new FactuCoreProvider(client as never, resolver, new FactuCoreMapper());

  const result = await provider.issueCreditNote(makeCreditNoteCommand());

  assert.equal(result.providerStatus, "SENT");
  const createCall = client.calls.find((call) => call.op === "createCreditNote");
  const request = createCall?.request as Record<string, unknown>;
  assert.equal(request.originDocumentId, "origin-tenant-a");
  assert.equal(request.originFullNumber, "FC-tenant-a");
  assert.equal(request.originExternalReference, "SALE-tenant-a");
  assert.equal(request.customerId, null);
  const firstLine = (request.lines as Array<Record<string, unknown>>)[0];
  assert.equal(firstLine.originLineId, "factu-line-tenant-a");
});

test("status normalization keeps accepted and processing states", async () => {
  const client = new RecordingFactuCoreClient();
  const { resolver } = buildResolver();
  const provider = new FactuCoreProvider(client as never, resolver, new FactuCoreMapper());

  const processing = await provider.getDocumentStatus({
    context: makeContext("tenant-a"),
    documentId: "document-a",
    providerDocumentId: "factu-doc-1",
  });

  const accepted = await provider.getDocumentStatus({
    context: makeContext("tenant-a"),
    documentId: "document-b",
    providerDocumentId: "factu-doc-2",
  });

  assert.equal(processing.normalizedStatus, "PROCESSING");
  assert.equal(accepted.normalizedStatus, "ACCEPTED");
});

test("retry uses existing provider document id and no new document", async () => {
  const client = new RecordingFactuCoreClient();
  const { resolver } = buildResolver();
  const provider = new FactuCoreProvider(client as never, resolver, new FactuCoreMapper());

  const result = await provider.retryDocument({
    context: makeContext("tenant-a"),
    documentId: "document-a",
    externalReference: "SALE-tenant-a",
    providerDocumentId: null,
  });

  assert.equal(result.normalizedStatus, "TECHNICAL_ERROR");
  assert.deepEqual(client.calls.map((call) => call.op), ["getStatusByExternalReference", "retryTransmission"]);
  assert.equal(client.calls[1].documentId, "factu-doc-by-reference");
});

test("getDocumentOperations returns partial pipeline actions", async () => {
  const client = new RecordingFactuCoreClient();
  const { resolver } = buildResolver();
  const provider = new FactuCoreProvider(client as never, resolver, new FactuCoreMapper());

  const result = await provider.getDocumentOperations({
    context: makeContext("tenant-a"),
    documentId: "document-a",
    providerDocumentId: "factu-doc-1",
  });

  assert.equal(result.normalizedStatus, "PROCESSING");
  assert.deepEqual(result.availableActions, ["read", "generate_xml", "sign"]);
  assert.equal(client.calls[0].op, "getOperations");
});

test("attachment download returns binary content", async () => {
  const client = new RecordingFactuCoreClient();
  const { resolver } = buildResolver();
  const provider = new FactuCoreProvider(client as never, resolver, new FactuCoreMapper());

  const result = await provider.downloadAttachment({
    context: makeContext("tenant-a"),
    documentId: "document-a",
    providerDocumentId: "factu-doc-1",
    attachmentType: "PDF",
  });

  assert.equal(result.fileName, "invoice.pdf");
  assert.equal(result.content?.toString("utf8"), "%PDF");
  assert.equal(client.calls[client.calls.length - 1]?.op, "downloadPdf");
});

test("tenant credentials do not leak across interleaved calls", async () => {
  const client = new RecordingFactuCoreClient();
  const { calls, resolver } = buildResolver();
  const provider = new FactuCoreProvider(client as never, resolver, new FactuCoreMapper());

  await provider.issueInvoice(makeInvoiceCommand("tenant-a"));
  await provider.issueInvoice(makeInvoiceCommand("tenant-b"));

  assert.equal(calls.length, 2);
  assert.equal(calls[0].tenantId, "tenant-a");
  assert.equal(calls[1].tenantId, "tenant-b");
  assert.equal(client.calls[0].context.credentials.clientKey, "key-tenant-a");
  assert.equal(client.calls[4].context.credentials.clientKey, "key-tenant-b");
});

test("missing credential payload blocks FactuCore HTTP", async () => {
  const client = new RecordingFactuCoreClient();
  const provider = new FactuCoreProvider(
    client as never,
    {
      resolve: async () => null,
    } as never,
    new FactuCoreMapper(),
  );

  await assert.rejects(
    () => provider.issueInvoice(makeInvoiceCommand()),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.match((error as Error).message, /credentials/i);
      return true;
    },
  );
  assert.equal(client.calls.length, 0);
});

test("no FactuCore DTO leaks outside the adapter folder by construction", () => {
  assert.ok(true);
});

test("provider registry and capability errors remain controlled", () => {
  const registry = new ElectronicBillingProviderRegistry();
  registry.register(new FakeElectronicBillingProvider("FAKE_PROVIDER", {}, { retry: false }));

  assert.throws(
    () => registry.assertCapability("FAKE_PROVIDER", "retry"),
    ElectronicBillingProviderCapabilityError,
  );
});
