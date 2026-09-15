import assert from "node:assert/strict";
import test from "node:test";
import {
  ElectronicBillingProviderCapabilityError,
  ElectronicBillingProviderNotRegisteredError,
  assertElectronicBillingProviderCapability,
  ElectronicBillingProviderRegistry,
  ElectronicBillingProviderContext,
  ElectronicBillingProviderStatusResult,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
} from "../src/modules/electronic-billing";
import { FakeElectronicBillingProvider } from "../src/modules/electronic-billing/providers";
import {
  SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE,
  type SaleCompletedForElectronicBillingEventEnvelope,
} from "../src/modules/electronic-billing/contracts/electronic-billing-integration-events";
import {
  buildDeterministicSaleExternalReference,
  buildElectronicBillingCustomer,
  buildElectronicBillingInvoiceCommandFromSaleEvent,
} from "../src/modules/electronic-billing/mappers/sale-completed-for-electronic-billing.mapper";
import { FactuCoreMapper } from "../src/modules/electronic-billing/providers/factucore";

const ids = {
  tenantA: "00000000-0000-0000-0000-000000000201",
  providerId: "00000000-0000-0000-0000-000000000202",
  configId: "00000000-0000-0000-0000-000000000203",
  documentId: "00000000-0000-0000-0000-000000000204",
  creditNoteId: "00000000-0000-0000-0000-000000000205",
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

const buildInvoiceCommand = (
  overrides: Partial<IssueElectronicInvoiceCommand> = {},
): IssueElectronicInvoiceCommand => ({
  context: overrides.context ?? baseContext,
  documentId: overrides.documentId ?? ids.documentId,
  externalReference: overrides.externalReference ?? "SALE-200",
  issueDate: overrides.issueDate ?? new Date("2026-08-28T00:00:00.000Z"),
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

const buildCreditNoteCommand = (
  overrides: Partial<IssueElectronicCreditNoteCommand> = {},
): IssueElectronicCreditNoteCommand => ({
  ...buildInvoiceCommand(overrides),
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

test("canonical invoice command is provider neutral", () => {
  const command = buildInvoiceCommand();

  assert.equal("originDocumentId" in command, false);
  assert.equal("discrepancyResponseCode" in command, false);
  assert.equal(command.context.tenantId, ids.tenantA);
});

test("canonical credit note command includes original document abstraction", () => {
  const command = buildCreditNoteCommand();

  assert.equal(command.originalDocument.internalDocumentId, ids.documentId);
  assert.equal(command.originalDocument.externalReference, "SALE-200");
  assert.equal(command.reason.reasonType, "RETURN");
});

test("provider registry resolves fake provider", () => {
  const registry = new ElectronicBillingProviderRegistry();
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER");

  registry.register(provider);

  const resolved = registry.resolve("fake_provider");
  assert.equal(resolved.code, "FAKE_PROVIDER");
  assert.equal(registry.has("FAKE_PROVIDER"), true);
  assert.deepEqual(registry.listCodes(), ["FAKE_PROVIDER"]);
});

test("provider registry throws controlled error for unknown provider", () => {
  const registry = new ElectronicBillingProviderRegistry();

  assert.throws(
    () => registry.resolve("UNKNOWN"),
    ElectronicBillingProviderNotRegisteredError,
  );
});

test("provider registry throws capability error", () => {
  const registry = new ElectronicBillingProviderRegistry();
  registry.register(
    new FakeElectronicBillingProvider("FAKE_PROVIDER", {}, { creditNote: false }),
  );

  assert.throws(
    () => registry.assertCapability("FAKE_PROVIDER", "creditNote"),
    ElectronicBillingProviderCapabilityError,
  );
});

test("fake provider supports PROCESSING and ACCEPTED responses", async () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER", {
    getDocumentStatus: async (command): Promise<ElectronicBillingProviderStatusResult> => ({
      documentId: command.documentId,
      providerDocumentId: command.providerDocumentId ?? "FAKE-1",
      providerStatus: "ACCEPTED",
      normalizedStatus: "ACCEPTED",
      providerStatusDetail: "accepted",
      prefix: "FKE",
      number: "1",
      fullNumber: "FKE-1",
      cufe: "CUFE-123",
      cude: null,
      acceptedAt: new Date("2026-08-28T00:00:00.000Z"),
      rejectedAt: null,
      errorCode: null,
      errorMessage: null,
      metadata: { accepted: true },
    }),
  });

  const processing = await provider.issueInvoice(buildInvoiceCommand());
  const accepted = await provider.getDocumentStatus({
    context: baseContext,
    documentId: ids.documentId,
    providerDocumentId: processing.providerDocumentId,
  });

  assert.equal(processing.normalizedStatus, "PROCESSING");
  assert.equal(accepted.normalizedStatus, "ACCEPTED");
});

test("provider capability assertion passes for supported fake provider", () => {
  const provider = new FakeElectronicBillingProvider("FAKE_PROVIDER");

  assert.doesNotThrow(() =>
    assertElectronicBillingProviderCapability(provider, "invoice"),
  );
});

test("sale billing integration event builds deterministic invoice command", () => {
  const event: SaleCompletedForElectronicBillingEventEnvelope = {
    eventId: "event-1",
    eventType: SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE,
    schemaVersion: 1,
    tenantId: ids.tenantA,
    correlationId: "corr-1",
    occurredAt: "2026-08-28T00:00:00.000Z",
    source: {
      type: "SALE",
      id: "sale-200",
    },
    payload: {
      sale: {
        saleId: "sale-200",
        saleType: "CASH",
        saleStatus: "COMPLETED",
        currencyCode: "COP",
        completedAt: "2026-08-28T00:00:00.000Z",
      },
      customer: {
        identification: {
          typeCode: "31",
          number: "900123456",
        },
        legalName: "Client SA",
        email: "client@example.com",
        municipalityCode: "11001",
        metadata: {},
      },
      lines: [
        {
          sourceLineId: "line-1",
          description: "Product 1",
          quantity: "1",
          unitCode: "EA",
          unitPrice: "1000",
          subtotalAmount: "1000",
          taxAmount: "190",
          totalAmount: "1190",
          taxes: [
            {
              type: "IVA",
              code: "01",
              rate: "19",
              taxableBase: "1000",
              amount: "190",
            },
          ],
        },
      ],
      taxes: [
        {
          sourceLineId: "line-1",
          type: "IVA",
          code: "01",
          rate: "19",
          taxableBase: "1000",
          amount: "190",
        },
      ],
      payments: [
        {
          methodCode: "10",
          amount: "1190",
        },
      ],
      totals: {
        subtotalAmount: "1000",
        discountAmount: "0",
        taxAmount: "190",
        totalAmount: "1190",
      },
      currencyCode: "COP",
      metadata: {
        source: "sale",
      },
    },
  };

  const command = buildElectronicBillingInvoiceCommandFromSaleEvent(event, {
    tenantId: ids.tenantA,
    providerId: ids.providerId,
    providerConfigId: ids.configId,
    environment: "TEST",
    baseUrl: null,
    credentialReference: null,
    settings: {},
  }, "document-1");

  assert.equal(command.externalReference, buildDeterministicSaleExternalReference(ids.tenantA, "sale-200"));
  assert.equal(command.documentId, "document-1");
  assert.equal(command.lines.length, 1);
  assert.equal(command.metadata?.integrationEvent?.eventId, "event-1");
});

test("real create-path customer location fields survive the billing boundary", () => {
  const customer = buildElectronicBillingCustomer({
    customerType: "COMPANY",
    identificationTypeCode: "31",
    identificationNumber: "900123456",
    legalName: "QA Customer",
    addressLine1: "CL 1 2 3",
    municipalityCode: "05001",
    departmentCode: "05",
    cityName: "Medellin",
    departmentName: "Antioquia",
    countryName: "Colombia",
    taxLevelCode: "IVA",
    taxSchemeId: "IVA",
    fiscalResponsibilityCodes: ["O-13"],
  });

  const request = new FactuCoreMapper().buildInvoiceRequest(buildInvoiceCommand({
    customer,
  }));

  assert.equal(customer.metadata?.departmentCode, "05");
  assert.equal(customer.metadata?.cityName, "Medellin");
  assert.equal(request.customer.departmentCode, "05");
  assert.equal(request.customer.cityName, "Medellin");
  assert.equal(request.customer.departmentName, "Antioquia");
  assert.equal(request.customer.countryName, "Colombia");
});

test("flattened customer location metadata survives the FactuCore mapping", () => {
  const customer = buildElectronicBillingCustomer({
    customerType: "PERSON",
    identificationTypeCode: "13",
    identificationNumber: "123456789",
    legalName: "QA Customer",
    addressLine1: "CL 1 2 3",
    metadata: {
      departmentCode: "05",
      municipalityCode: "05001",
      cityName: "Medellin",
      departmentName: "Antioquia",
    },
  });

  const request = new FactuCoreMapper().buildInvoiceRequest(buildInvoiceCommand({
    customer,
  }));

  assert.equal(request.customer.departmentCode, "05");
  assert.equal(request.customer.municipalityCode, "05001");
});

test("sale billing integration event keeps mixed payment snapshot in metadata", () => {
  const event: SaleCompletedForElectronicBillingEventEnvelope = {
    eventId: "event-2",
    eventType: SALE_COMPLETED_FOR_ELECTRONIC_BILLING_EVENT_TYPE,
    schemaVersion: 1,
    tenantId: ids.tenantA,
    correlationId: "corr-2",
    occurredAt: "2026-08-28T00:00:00.000Z",
    source: {
      type: "SALE",
      id: "sale-201",
    },
    payload: {
      sale: {
        saleId: "sale-201",
        saleType: "CASH",
        saleStatus: "COMPLETED",
        currencyCode: "COP",
        completedAt: "2026-08-28T00:00:00.000Z",
      },
      customer: {
        identification: {
          typeCode: "31",
          number: "900123456",
        },
        legalName: "Client SA",
        email: "client@example.com",
        municipalityCode: "11001",
        metadata: {},
      },
      lines: [
        {
          sourceLineId: "line-1",
          description: "Product 1",
          quantity: "1",
          unitPrice: "1000",
          subtotalAmount: "1000",
          taxAmount: "190",
          totalAmount: "1190",
          taxes: [],
        },
      ],
      taxes: [],
      payments: [
        {
          methodCode: "10",
          amount: "700",
        },
        {
          methodCode: "20",
          amount: "490",
        },
      ],
      totals: {
        subtotalAmount: "1000",
        discountAmount: "0",
        taxAmount: "190",
        totalAmount: "1190",
      },
      currencyCode: "COP",
      metadata: {},
    },
  };

  const command = buildElectronicBillingInvoiceCommandFromSaleEvent(
    event,
    {
      tenantId: ids.tenantA,
      providerId: ids.providerId,
      providerConfigId: ids.configId,
      environment: "TEST",
      baseUrl: null,
      credentialReference: null,
      settings: {},
    },
    "document-2",
  );

  assert.equal(command.payment, null);
  assert.equal(Array.isArray(command.metadata?.payments), true);
  assert.equal((command.metadata?.payments as Array<unknown>).length, 2);
});
