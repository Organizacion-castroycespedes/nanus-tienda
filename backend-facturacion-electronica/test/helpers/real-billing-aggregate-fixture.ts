import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { ElectronicBillingProviderError } from "../../src/modules/electronic-billing/contracts/electronic-billing-errors";
import { DatabaseService } from "../../src/modules/database/database.service";
import {
  ElectronicBillingProviderRepository,
  ElectronicDocumentEventRepository,
  ElectronicDocumentLineRepository,
  ElectronicDocumentReferenceRepository,
  ElectronicDocumentRepository,
  ElectronicDocumentTaxRepository,
  TenantElectronicBillingConfigRepository,
} from "../../src/modules/electronic-billing/repositories/electronic-billing.repositories";
import { ElectronicBillingProviderRegistry } from "../../src/modules/electronic-billing/providers/electronic-billing-provider-registry";
import { ElectronicBillingProviderResolver } from "../../src/modules/electronic-billing/providers/electronic-billing-provider-resolver";
import { ElectronicBillingProcessingService } from "../../src/modules/electronic-billing/services/electronic-billing-processing.service";
import type { ElectronicBillingProvider } from "../../src/modules/electronic-billing/contracts/electronic-billing-provider";
import type {
  ElectronicBillingProviderCapabilities,
  ElectronicBillingProviderDocumentResult,
  ElectronicBillingProviderStatusResult,
  GetElectronicDocumentStatusCommand,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
} from "../../src/modules/electronic-billing/contracts/electronic-billing-commands";
import type { ElectronicBillingProcessingStage } from "../../src/modules/electronic-billing/contracts/processing-state";

const currentFile = fileURLToPath(import.meta.url);
const repositoryRoot = join(dirname(currentFile), "../../..");
const ids = (counter: number) => {
  const suffix = counter.toString(16).padStart(12, "0");
  return {
    tenant: `00000000-0000-0000-0000-${suffix}`,
    provider: `10000000-0000-0000-0000-${suffix}`,
    config: `20000000-0000-0000-0000-${suffix}`,
    document: `30000000-0000-0000-0000-${suffix}`,
    line: `40000000-0000-0000-0000-${suffix}`,
    tax: `50000000-0000-0000-0000-${suffix}`,
    event: `60000000-0000-0000-0000-${suffix}`,
  };
};

export class PersistentBillingProviderMock implements ElectronicBillingProvider {
  readonly code: string;
  readonly capabilities: ElectronicBillingProviderCapabilities = {
    invoice: true,
    creditNote: true,
    debitNote: false,
    retry: false,
    pdf: false,
    xml: false,
    signedXml: false,
    asyncStatus: true,
    attachmentDownload: false,
  };
  readonly providerDocuments = new Map<string, string>();
  readonly statusByDocument = new Map<string, ElectronicBillingProviderStatusResult["normalizedStatus"]>();
  createCalls = 0;
  statusCalls = 0;
  issueFailure: "NONE" | "TIMEOUT_AFTER_PERSIST" = "NONE";
  statusFailure: "NONE" | "NOT_FOUND" | "UNAVAILABLE" = "NONE";

  constructor(code: string) {
    this.code = code;
  }

  async issueInvoice(command: IssueElectronicInvoiceCommand): Promise<ElectronicBillingProviderDocumentResult> {
    this.createCalls += 1;
    const providerDocumentId = this.providerDocuments.get(command.externalReference) ?? `PHASE511-${command.externalReference}`;
    this.providerDocuments.set(command.externalReference, providerDocumentId);
    const normalizedStatus = this.statusByDocument.get(command.documentId) ?? "ACCEPTED";
    if (this.issueFailure === "TIMEOUT_AFTER_PERSIST") {
      throw new ElectronicBillingProviderError("provider response timeout", "PROVIDER_TIMEOUT");
    }
    return {
      documentId: command.documentId,
      providerDocumentId,
      providerStatus: normalizedStatus,
      normalizedStatus,
      providerStatusDetail: null,
      prefix: "P511",
      number: "1",
      fullNumber: "P511-1",
      cufe: normalizedStatus === "ACCEPTED" ? `CUFE-${command.documentId}` : null,
      cude: null,
      acceptedAt: normalizedStatus === "ACCEPTED" ? new Date() : null,
      rejectedAt: null,
      metadata: {},
    };
  }

  async issueCreditNote(command: IssueElectronicCreditNoteCommand): Promise<ElectronicBillingProviderDocumentResult> {
    return this.issueInvoice(command);
  }

  async getDocumentStatus(command: GetElectronicDocumentStatusCommand): Promise<ElectronicBillingProviderStatusResult> {
    this.statusCalls += 1;
    if (this.statusFailure === "NOT_FOUND") {
      const error = new ElectronicBillingProviderError("provider document not found", "PROVIDER_NOT_FOUND") as ElectronicBillingProviderError & { httpStatus?: number };
      error.httpStatus = 404;
      throw error;
    }
    if (this.statusFailure === "UNAVAILABLE") {
      throw new ElectronicBillingProviderError("provider unavailable", "PROVIDER_UNAVAILABLE");
    }
    const normalizedStatus = this.statusByDocument.get(command.documentId) ?? "ACCEPTED";
    return {
      documentId: command.documentId,
      providerDocumentId: command.providerDocumentId ?? this.providerDocuments.get(command.externalReference ?? "") ?? null,
      providerStatus: normalizedStatus,
      normalizedStatus,
      providerStatusDetail: null,
      prefix: "P511",
      number: "1",
      fullNumber: "P511-1",
      cufe: normalizedStatus === "ACCEPTED" ? `CUFE-${command.documentId}` : null,
      cude: null,
      acceptedAt: normalizedStatus === "ACCEPTED" ? new Date() : null,
      rejectedAt: null,
      errorCode: null,
      errorMessage: null,
      metadata: {},
    };
  }
}

let schemaReady: Promise<void> | null = null;
let fixtureCounter = 511;

const ensureSchema = async (pool: Pool) => {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await pool.connect();
      try {
        for (const relativePath of [
          "scripts/database/001_initial_schema.sql",
          "scripts/database/migrations/V072__electronic_billing_base_persistence.sql",
          "scripts/database/migrations/V073__electronic_billing_inbox_events.sql",
          "scripts/database/migrations/V074__integration_outbox_events.sql",
          "scripts/database/migrations/V076__electronic_billing_processing_stage.sql",
        ]) {
          await client.query(await readFile(join(repositoryRoot, relativePath), "utf8"));
        }
        await client.query("DELETE FROM electronic_documents WHERE external_reference LIKE 'PHASE511-%'");
        await client.query("DELETE FROM tenant_electronic_billing_configs WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'phase511-%')");
        await client.query("DELETE FROM electronic_billing_providers WHERE code LIKE 'PHASE511_MOCK_%'");
        await client.query("DELETE FROM tenants WHERE slug LIKE 'phase511-%'");
      } finally {
        client.release();
      }
    })();
  }
  await schemaReady;
};

export class RealBillingAggregateFixture {
  readonly db: DatabaseService;
  readonly provider: PersistentBillingProviderMock;
  readonly documentRepository: ElectronicDocumentRepository;
  readonly processingService: ElectronicBillingProcessingService;
  readonly ids = ids(fixtureCounter++);

  private constructor(
    private readonly pool: Pool,
    db: DatabaseService,
    provider: PersistentBillingProviderMock,
    documentRepository: ElectronicDocumentRepository,
    processingService: ElectronicBillingProcessingService,
  ) {
    this.db = db;
    this.provider = provider;
    this.documentRepository = documentRepository;
    this.processingService = processingService;
  }

  static async create(pool: Pool, stage: ElectronicBillingProcessingStage, providerLinked = false) {
    await ensureSchema(pool);
    const db = new DatabaseService({
      config: {
        host: "localhost",
        port: 55432,
        database: "manus_billing_concurrency_test",
        username: "postgres",
        password: "",
        ssl: false,
        logging: false,
        poolMax: 4,
      },
      poolFactory: () => pool,
    });
    const provider = new PersistentBillingProviderMock(`PHASE511_MOCK_${fixtureCounter}`);
    const providerRegistry = new ElectronicBillingProviderRegistry();
    providerRegistry.register(provider);
    const providerRepository = new ElectronicBillingProviderRepository(db);
    const configRepository = new TenantElectronicBillingConfigRepository(db);
    const documentRepository = new ElectronicDocumentRepository(db);
    const lineRepository = new ElectronicDocumentLineRepository(db);
    const taxRepository = new ElectronicDocumentTaxRepository(db);
    const referenceRepository = new ElectronicDocumentReferenceRepository(db);
    const eventRepository = new ElectronicDocumentEventRepository(db);
    const resolver = new ElectronicBillingProviderResolver(providerRegistry, providerRepository, configRepository);
    const processingService = new ElectronicBillingProcessingService(
      db,
      documentRepository,
      lineRepository,
      taxRepository,
      referenceRepository,
      eventRepository,
      resolver,
    );
    const fixture = new RealBillingAggregateFixture(pool, db, provider, documentRepository, processingService);
    const now = new Date();
    await db.query("INSERT INTO tenants (id, slug, nombre) VALUES ($1, $2, $3)", [fixture.ids.tenant, `phase511-${fixture.ids.tenant.slice(-6)}`, "Phase 5.11 Fixture"]);
    await providerRepository.create({ id: fixture.ids.provider, code: provider.code, name: "Phase 5.11 Provider", createdAt: now, updatedAt: now });
    await configRepository.create({ id: fixture.ids.config, tenantId: fixture.ids.tenant, providerId: fixture.ids.provider, environment: "TEST", enabled: true, baseUrl: "http://phase511.invalid", settings: {}, isDefault: true, createdAt: now, updatedAt: now });
    await documentRepository.create({
      id: fixture.ids.document,
      tenantId: fixture.ids.tenant,
      providerId: fixture.ids.provider,
      providerConfigId: fixture.ids.config,
      documentType: "INVOICE",
      sourceType: "SALE",
      sourceId: fixture.ids.document,
      externalReference: `PHASE511-${fixture.ids.document}`,
      providerDocumentId: providerLinked ? `PHASE511-${fixture.ids.document}` : null,
      status: providerLinked ? "PROCESSING" : "PENDING",
      providerStatus: providerLinked ? "PROCESSING" : null,
      currencyCode: "COP",
      subtotalAmount: 1000,
      discountAmount: 0,
      taxAmount: 190,
      totalAmount: 1190,
      issueDate: now,
      issueTime: "10:00:00",
      processingStage: stage,
      processingStageUpdatedAt: now,
      metadata: { electronicBilling: { customer: { identification: { number: "900123456", typeCode: "31" }, legalName: "Phase 5.11 Customer" }, payment: { methodCode: "10" } } },
      createdAt: now,
      updatedAt: now,
    });
    const lineRepositoryInput = { id: fixture.ids.line, electronicDocumentId: fixture.ids.document, sourceLineType: "SALE" as const, sourceLineId: fixture.ids.line, sku: "P511-SKU", description: "Phase 5.11 Product", quantity: 1, unitCode: "EA", unitPrice: 1000, discountAmount: 0, subtotalAmount: 1000, taxAmount: 190, totalAmount: 1190, createdAt: now, updatedAt: now };
    await lineRepository.insertMany([lineRepositoryInput]);
    await taxRepository.insertMany([{ id: fixture.ids.tax, electronicDocumentId: fixture.ids.document, electronicDocumentLineId: fixture.ids.line, taxType: "IVA", taxCode: "01", rate: 19, taxableBase: 1000, taxAmount: 190, createdAt: now }]);
    await eventRepository.append({ id: fixture.ids.event, electronicDocumentId: fixture.ids.document, eventType: "DOCUMENT_CREATED", status: "PENDING", operation: "CREATE", attempt: 1, createdAt: now });
    return fixture;
  }

  async reload() {
    return this.documentRepository.findById(this.ids.tenant, this.ids.document);
  }

  async markStaleProcessing(stage: ElectronicBillingProcessingStage = "PRE_PROVIDER_CREATE") {
    const staleAt = new Date(Date.now() - 600_000);
    await this.pool.query(
      `UPDATE electronic_documents
       SET status = 'PROCESSING',
           last_status_check_at = $3,
           processing_stage = $4,
           processing_stage_updated_at = $3,
           updated_at = $3
       WHERE tenant_id = $1 AND id = $2`,
      [this.ids.tenant, this.ids.document, staleAt, stage],
    );
  }

  createProcessingService() {
    const providerRegistry = new ElectronicBillingProviderRegistry();
    providerRegistry.register(this.provider);
    const providerRepository = new ElectronicBillingProviderRepository(this.db);
    const configRepository = new TenantElectronicBillingConfigRepository(this.db);
    const resolver = new ElectronicBillingProviderResolver(providerRegistry, providerRepository, configRepository);
    return new ElectronicBillingProcessingService(
      this.db,
      this.documentRepository,
      new ElectronicDocumentLineRepository(this.db),
      new ElectronicDocumentTaxRepository(this.db),
      new ElectronicDocumentReferenceRepository(this.db),
      new ElectronicDocumentEventRepository(this.db),
      resolver,
    );
  }

  async cleanup() {
    await this.pool.query("DELETE FROM electronic_documents WHERE tenant_id = $1", [this.ids.tenant]);
    await this.pool.query("DELETE FROM tenant_electronic_billing_configs WHERE id = $1", [this.ids.config]);
    await this.pool.query("DELETE FROM tenants WHERE id = $1", [this.ids.tenant]);
    await this.pool.query("DELETE FROM electronic_billing_providers WHERE id = $1", [this.ids.provider]);
  }
}
