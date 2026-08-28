import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectronicBillingProviderCapabilityError,
  ElectronicBillingProviderDisabledError,
  ElectronicBillingProviderNotRegisteredError,
} from "../contracts/electronic-billing-errors";
import {
  assertElectronicBillingProviderCapability,
} from "../contracts/electronic-billing-provider";
import type {
  ElectronicBillingProviderContext,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
} from "../contracts/electronic-billing-commands";
import {
  ElectronicBillingProviderRegistry,
} from "./electronic-billing-provider-registry";
import {
  ElectronicBillingProviderResolver,
} from "./electronic-billing-provider-resolver";
import { FakeElectronicBillingProvider } from "./fake-electronic-billing-provider";

const ids = {
  tenantA: "00000000-0000-0000-0000-000000000101",
  tenantB: "00000000-0000-0000-0000-000000000102",
  providerId: "00000000-0000-0000-0000-000000000103",
  providerIdB: "00000000-0000-0000-0000-000000000104",
  configId: "00000000-0000-0000-0000-000000000105",
  configIdB: "00000000-0000-0000-0000-000000000106",
  documentId: "00000000-0000-0000-0000-000000000107",
  creditNoteId: "00000000-0000-0000-0000-000000000108",
};

const baseContext: ElectronicBillingProviderContext = {
  tenantId: ids.tenantA,
  providerId: ids.providerId,
  providerConfigId: ids.configId,
  environment: "TEST",
  baseUrl: null,
  credentialReference: null,
  settings: {},
};

const buildProviderRepository = (records: Array<{ id: string; code: string; name: string }>) => ({
  findById: async (id: string) => {
    const record = records.find((candidate) => candidate.id === id);
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      provider_type: "ELECTRONIC_BILLING",
      active: true,
      capabilities: ["invoice"],
      created_at: new Date(),
      updated_at: new Date(),
    };
  },
});

const buildConfigRepository = (
  records: Array<{
    id: string;
    tenant_id: string;
    provider_id: string;
    enabled: boolean;
    is_default: boolean;
  }>,
) => ({
  findById: async (id: string, tenantId: string) => {
    const record = records.find(
      (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
    );
    if (!record) {
      return null;
    }
    return {
      ...record,
      environment: "TEST",
      base_url: null,
      credential_reference: null,
      settings: {},
      created_at: new Date(),
      updated_at: new Date(),
    };
  },
  findDefaultForTenant: async (tenantId: string) => {
    const record = records.find(
      (candidate) => candidate.tenant_id === tenantId && candidate.is_default,
    );
    if (!record) {
      return null;
    }
    return {
      ...record,
      environment: "TEST",
      base_url: null,
      credential_reference: null,
      settings: {},
      created_at: new Date(),
      updated_at: new Date(),
    };
  },
});

const makeInvoiceCommand = (
  overrides: Partial<IssueElectronicInvoiceCommand> = {},
): IssueElectronicInvoiceCommand => ({
  context: overrides.context ?? baseContext,
  documentId: overrides.documentId ?? ids.documentId,
  externalReference: overrides.externalReference ?? "SALE-200",
  issueDate: overrides.issueDate ?? new Date("2026-08-27T00:00:00.000Z"),
  issueTime: overrides.issueTime ?? "10:15:00",
  customer: overrides.customer ?? {
    identification: {
      typeCode: "31",
      number: "900123456",
    },
    legalName: "Client SA",
    email: "client@example.com",
    municipalityCode: "11001",
    metadata: {},
  },
  payment: overrides.payment ?? {
    methodCode: "10",
    term: "IMMEDIATE",
  },
  lines: overrides.lines ?? [
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
  totals: overrides.totals ?? {
    subtotalAmount: 1000,
    discountAmount: 0,
    taxAmount: 190,
    totalAmount: 1190,
    currencyCode: "COP",
  },
  metadata: overrides.metadata ?? { source: "sale" },
});

const makeCreditNoteCommand = (
  overrides: Partial<IssueElectronicCreditNoteCommand> = {},
): IssueElectronicCreditNoteCommand => ({
  ...makeInvoiceCommand(overrides),
  context: overrides.context ?? baseContext,
  documentId: overrides.documentId ?? ids.creditNoteId,
  externalReference: overrides.externalReference ?? "RETURN-300",
  originalDocument: overrides.originalDocument ?? {
    internalDocumentId: ids.documentId,
    providerDocumentId: "PROVIDER-123",
    externalReference: "SALE-200",
    fullNumber: "FKE-1",
  },
  reason: overrides.reason ?? {
    reasonCode: "01",
    reasonDescription: "Return",
    reasonType: "RETURN",
    metadata: {},
  },
});

test("registry resolves a registered fake provider by code", async () => {
  const registry = new ElectronicBillingProviderRegistry();
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER");

  registry.register(provider);

  const resolved = registry.resolve("fake_provider");
  assert.equal(resolved.code, "FAKE_PROVIDER");
  assert.equal(registry.has("FAKE_PROVIDER"), true);
  assert.deepEqual(registry.listCodes(), ["FAKE_PROVIDER"]);
});

test("registry throws controlled error for unknown provider code", async () => {
  const registry = new ElectronicBillingProviderRegistry();

  assert.throws(() => registry.resolve("UNKNOWN"), ElectronicBillingProviderNotRegisteredError);
});

test("registry throws controlled capability error", async () => {
  const registry = new ElectronicBillingProviderRegistry();
  registry.register(new FakeElectronicBillingProvider("FAKE_PROVIDER", {}, { creditNote: false }));

  assert.throws(
    () => registry.assertCapability("FAKE_PROVIDER", "creditNote"),
    ElectronicBillingProviderCapabilityError,
  );
});

test("resolver rejects missing tenant config", async () => {
  const registry = new ElectronicBillingProviderRegistry();
  const resolver = new ElectronicBillingProviderResolver(
    registry,
    buildProviderRepository([]) as never,
    buildConfigRepository([]) as never,
  );

  await assert.rejects(
    () =>
      resolver.resolve({
        tenantId: ids.tenantA,
      }),
    ElectronicBillingProviderDisabledError,
  );
});

test("resolver returns default provider for tenant", async () => {
  const registry = new ElectronicBillingProviderRegistry();
  registry.register(new FakeElectronicBillingProvider("FAKE_PROVIDER"));

  const resolver = new ElectronicBillingProviderResolver(
    registry,
    buildProviderRepository([
      {
        id: ids.providerId,
        code: "FAKE_PROVIDER",
        name: "Fake Provider",
      },
    ]) as never,
    buildConfigRepository([
      {
        id: ids.configId,
        tenant_id: ids.tenantA,
        provider_id: ids.providerId,
        enabled: true,
        is_default: true,
      },
    ]) as never,
  );

  const resolved = await resolver.resolve({
    tenantId: ids.tenantA,
  });

  assert.equal(resolved.provider.code, "FAKE_PROVIDER");
  assert.equal(resolved.config.configId, ids.configId);
  assert.equal(resolved.context.tenantId, ids.tenantA);
  assert.equal(resolved.context.credentialReference, null);
});

test("resolver rejects disabled provider configuration", async () => {
  const registry = new ElectronicBillingProviderRegistry();
  registry.register(new FakeElectronicBillingProvider("FAKE_PROVIDER"));

  const resolver = new ElectronicBillingProviderResolver(
    registry,
    buildProviderRepository([
      {
        id: ids.providerId,
        code: "FAKE_PROVIDER",
        name: "Fake Provider",
      },
    ]) as never,
    buildConfigRepository([
      {
        id: ids.configId,
        tenant_id: ids.tenantA,
        provider_id: ids.providerId,
        enabled: false,
        is_default: true,
      },
    ]) as never,
  );

  await assert.rejects(
    () =>
      resolver.resolve({
        tenantId: ids.tenantA,
        providerConfigId: ids.configId,
      }),
    ElectronicBillingProviderDisabledError,
  );
});

test("resolver never uses another tenant config", async () => {
  const registry = new ElectronicBillingProviderRegistry();
  registry.register(new FakeElectronicBillingProvider("FAKE_PROVIDER"));

  const resolver = new ElectronicBillingProviderResolver(
    registry,
    buildProviderRepository([
      {
        id: ids.providerId,
        code: "FAKE_PROVIDER",
        name: "Fake Provider",
      },
      {
        id: ids.providerIdB,
        code: "FAKE_PROVIDER",
        name: "Fake Provider",
      },
    ]) as never,
    buildConfigRepository([
      {
        id: ids.configId,
        tenant_id: ids.tenantA,
        provider_id: ids.providerId,
        enabled: true,
        is_default: true,
      },
      {
        id: ids.configIdB,
        tenant_id: ids.tenantB,
        provider_id: ids.providerIdB,
        enabled: true,
        is_default: true,
      },
    ]) as never,
  );

  const resolvedA = await resolver.resolve({
    tenantId: ids.tenantA,
    providerConfigId: ids.configId,
  });
  const resolvedB = await resolver.resolve({
    tenantId: ids.tenantB,
    providerConfigId: ids.configIdB,
  });

  assert.equal(resolvedA.context.tenantId, ids.tenantA);
  assert.equal(resolvedB.context.tenantId, ids.tenantB);
  assert.notEqual(resolvedA.context.providerConfigId, resolvedB.context.providerConfigId);
});

test("canonical invoice contains no FactuCore-specific fields", async () => {
  const command = makeInvoiceCommand();

  assert.equal("originDocumentId" in command, false);
  assert.equal("originFullNumber" in command, false);
  assert.equal("originExternalReference" in command, false);
  assert.equal("discrepancyResponseCode" in command, false);
  assert.equal(command.context.tenantId, ids.tenantA);
});

test("fake provider receives expected invoice command", async () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER");
  const command = makeInvoiceCommand();

  const result = await provider.issueInvoice(command);

  assert.equal(provider.received.issueInvoice.length, 1);
  assert.equal(provider.received.issueInvoice[0].externalReference, "SALE-200");
  assert.equal(provider.received.issueInvoice[0].context.providerConfigId, ids.configId);
  assert.equal(result.providerStatus, "SENT");
  assert.equal(result.normalizedStatus, "PROCESSING");
});

test("fake provider returns PROCESSING result", async () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER");

  const result = await provider.getDocumentStatus({
    context: baseContext,
    documentId: ids.documentId,
    providerDocumentId: "FAKE-1",
  });

  assert.equal(result.normalizedStatus, "PROCESSING");
  assert.equal(provider.received.getDocumentStatus.length, 1);
});

test("fake provider returns ACCEPTED result", async () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER", {
    getDocumentStatus: async (command) => ({
      documentId: command.documentId,
      providerDocumentId: command.providerDocumentId ?? "FAKE-ACCEPTED",
      providerStatus: "ACCEPTED",
      normalizedStatus: "ACCEPTED",
      providerStatusDetail: "accepted",
      prefix: "FKE",
      number: "1",
      fullNumber: "FKE-1",
      cufe: "CUFE-123",
      cude: null,
      acceptedAt: new Date("2026-08-27T00:00:00.000Z"),
      rejectedAt: null,
      errorCode: null,
      errorMessage: null,
      metadata: { accepted: true },
    }),
  });

  const result = await provider.getDocumentStatus({
    context: baseContext,
    documentId: ids.documentId,
    providerDocumentId: "FAKE-1",
  });

  assert.equal(result.normalizedStatus, "ACCEPTED");
  assert.equal(result.providerStatus, "ACCEPTED");
});

test("canonical credit note references original electronic document", async () => {
  const command = makeCreditNoteCommand();

  assert.equal(command.originalDocument.internalDocumentId, ids.documentId);
  assert.equal(command.originalDocument.externalReference, "SALE-200");
  assert.equal(command.originalDocument.fullNumber, "FKE-1");
});

test("canonical credit note supports provider original line identity", async () => {
  const command = makeCreditNoteCommand({
    lines: [
      {
        sourceLineId: "return-line-1",
        originalElectronicDocumentLineId: "orig-line-1",
        providerOriginalLineId: "provider-line-1",
        description: "Credit line",
        quantity: 1,
        unitCode: "EA",
        unitPrice: 1000,
        subtotalAmount: 1000,
        taxAmount: 190,
        totalAmount: 1190,
        taxes: [],
      },
    ],
  });

  assert.equal(command.lines[0].originalElectronicDocumentLineId, "orig-line-1");
  assert.equal(command.lines[0].providerOriginalLineId, "provider-line-1");
  assert.equal(command.lines[0].sourceLineId, "return-line-1");
});

test("no FactuCore discrepancy fields leak into domain", async () => {
  const command = makeCreditNoteCommand();

  assert.equal("discrepancyResponseCode" in command.reason, false);
  assert.equal("originDocumentId" in command, false);
  assert.equal("originLineId" in command.lines[0], false);
});

test("provider returns PROCESSING then ACCEPTED later", async () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER", {
    issueInvoice: async (command) => ({
      documentId: command.documentId,
      providerDocumentId: "FAKE-1",
      providerStatus: "SENT",
      normalizedStatus: "PROCESSING",
      metadata: { stage: "submitted" },
    }),
    getDocumentStatus: async (command) => ({
      documentId: command.documentId,
      providerDocumentId: command.providerDocumentId ?? "FAKE-1",
      providerStatus: "ACCEPTED",
      normalizedStatus: "ACCEPTED",
      metadata: { stage: "accepted" },
    }),
  });

  const invoiceResult = await provider.issueInvoice(makeInvoiceCommand());
  const statusResult = await provider.getDocumentStatus({
    context: baseContext,
    documentId: ids.documentId,
    providerDocumentId: invoiceResult.providerDocumentId,
  });

  assert.equal(invoiceResult.normalizedStatus, "PROCESSING");
  assert.equal(statusResult.normalizedStatus, "ACCEPTED");
});

test("fake provider returns partial operations for resume checks", async () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER");

  const result = await provider.getDocumentOperations?.({
    context: baseContext,
    documentId: ids.documentId,
    providerDocumentId: "FAKE-1",
  });

  assert.equal(result?.normalizedStatus, "PROCESSING");
  assert.deepEqual(result?.availableActions, ["read", "transmit"]);
  assert.equal(provider.received.getDocumentOperations.length, 1);
});

test("provider with retry capability works", async () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER");

  const result = await provider.retryDocument?.({
    context: baseContext,
    documentId: ids.documentId,
    providerDocumentId: "FAKE-1",
  });

  assert.equal(result?.providerStatus, "RETRY_REQUESTED");
  assert.equal(provider.received.retryDocument.length, 1);
});

test("provider without retry capability produces controlled behavior", async () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER", {}, { retry: false });

  assert.throws(
    () => assertElectronicBillingProviderCapability(provider, "retry"),
    ElectronicBillingProviderCapabilityError,
  );
});

test("pdf-capable provider returns neutral attachment descriptor", async () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER");

  const result = await provider.downloadAttachment?.({
    context: baseContext,
    documentId: ids.documentId,
    providerDocumentId: "FAKE-1",
    attachmentType: "PDF",
  });

  assert.equal(result?.attachmentType, "PDF");
  assert.equal(result?.storageProvider, "fake");
  assert.equal(result?.documentId, ids.documentId);
});

test("provider without PDF capability is handled correctly", async () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER", {}, { pdf: false });

  assert.throws(
    () => assertElectronicBillingProviderCapability(provider, "pdf"),
    ElectronicBillingProviderCapabilityError,
  );
});
