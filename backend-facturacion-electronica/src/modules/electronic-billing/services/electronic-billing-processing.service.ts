import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../database/database.service";
import { ElectronicBillingProviderError } from "../contracts/electronic-billing-errors";
import {
  ElectronicDocumentAlreadyProcessingError,
  ElectronicDocumentNotProcessableError,
  ElectronicDocumentProviderResultConflictError,
  ElectronicDocumentStatusTransitionError,
} from "../contracts/electronic-billing-errors";
import type {
  ElectronicBillingProviderDocumentResult,
  ElectronicBillingProviderStatusResult,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
} from "../contracts/electronic-billing-commands";
import {
  ElectronicBillingProviderResolver,
  type ResolvedElectronicBillingProvider,
} from "../providers/electronic-billing-provider-resolver";
import type {
  ElectronicDocumentEventType,
  ElectronicDocumentEventRecord,
  ElectronicDocumentLineRecord,
  ElectronicDocumentRecord,
  ElectronicDocumentReferenceRecord,
  ElectronicDocumentStatus,
  ElectronicDocumentTaxRecord,
} from "../repositories/electronic-billing-records";
import {
  ElectronicDocumentEventRepository,
  ElectronicDocumentLineRepository,
  ElectronicDocumentReferenceRepository,
  ElectronicDocumentRepository,
  ElectronicDocumentTaxRepository,
} from "../repositories/electronic-billing.repositories";

type LoadedAggregate = {
  document: ElectronicDocumentRecord;
  lines: ElectronicDocumentLineRecord[];
  taxes: ElectronicDocumentTaxRecord[];
  references: ElectronicDocumentReferenceRecord[];
  events: ElectronicDocumentEventRecord[];
};

type ProcessingResult = {
  document: ElectronicDocumentRecord;
  lines: ElectronicDocumentLineRecord[];
  taxes: ElectronicDocumentTaxRecord[];
  references: ElectronicDocumentReferenceRecord[];
  events: ElectronicDocumentEventRecord[];
  providerResult: ElectronicBillingProviderDocumentResult | ElectronicBillingProviderStatusResult | null;
  idempotent: boolean;
  retryable: boolean;
};

type BillingSnapshot = {
  customer?: IssueElectronicInvoiceCommand["customer"] | null;
  payment?: IssueElectronicInvoiceCommand["payment"] | null;
};

type LineSnapshot = {
  sourceLineId?: string | null;
  originalElectronicDocumentLineId?: string | null;
  providerOriginalLineId?: string | null;
};

type LineResultMetadata = {
  index: number;
  providerLineId: string | null;
  originLineId: string | null;
  lineNumber: number | string | null;
};

type ClaimedAggregateDocument = ElectronicDocumentRecord & {
  attempt: number;
};

const PROCESSABLE_STATUSES = new Set<ElectronicDocumentStatus>(["PENDING"]);
const RETRYABLE_STATUSES = new Set<ElectronicDocumentStatus>(["TECHNICAL_ERROR"]);
const TERMINAL_STATUSES = new Set<ElectronicDocumentStatus>(["ACCEPTED", "REJECTED", "CANCELLED"]);
const DEFAULT_PROCESSING_REFRESH_AFTER_MS = 60_000;
const DEFAULT_RETRY_BASE_DELAY_MS = 300_000;
const DEFAULT_RETRY_BACKOFF_CAP_MS = 3_600_000;

const readPositiveIntegerEnv = (name: string, fallback: number) => {
  const raw = Number(process.env[name]);
  if (Number.isInteger(raw) && raw > 0) {
    return raw;
  }

  return fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const readBillingSnapshot = (metadata: Record<string, unknown>): BillingSnapshot => {
  const snapshot = isRecord(metadata.electronicBilling) ? metadata.electronicBilling : null;
  if (!snapshot) {
    return {};
  }

  return {
    customer: (snapshot.customer as BillingSnapshot["customer"]) ?? null,
    payment: (snapshot.payment as BillingSnapshot["payment"]) ?? null,
  };
};

const readLineSnapshot = (metadata: Record<string, unknown>): LineSnapshot => {
  const snapshot = isRecord(metadata.electronicBilling) ? metadata.electronicBilling : null;
  if (!snapshot) {
    return {};
  }

  return {
    sourceLineId: typeof snapshot.sourceLineId === "string" ? snapshot.sourceLineId : null,
    originalElectronicDocumentLineId:
      typeof snapshot.originalElectronicDocumentLineId === "string"
        ? snapshot.originalElectronicDocumentLineId
        : null,
    providerOriginalLineId: typeof snapshot.providerOriginalLineId === "string" ? snapshot.providerOriginalLineId : null,
  };
};

const readLineResults = (metadata: Record<string, unknown>): LineResultMetadata[] => {
  const raw = metadata.lineResults;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item, index) => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        index,
        providerLineId:
          typeof item.providerLineId === "string"
            ? item.providerLineId
            : typeof item.id === "string"
              ? item.id
              : null,
        originLineId:
          typeof item.originLineId === "string"
            ? item.originLineId
            : null,
        lineNumber:
          typeof item.lineNumber === "number" || typeof item.lineNumber === "string"
            ? item.lineNumber
            : null,
      };
    })
    .filter((item) => item !== null) as LineResultMetadata[];
};

const isProcessingTerminalStatus = (status: ElectronicDocumentStatus) => TERMINAL_STATUSES.has(status);

const isRetryableProviderCode = (code: string) => {
  const normalized = code.toUpperCase();
  return (
    normalized.includes("TIMEOUT") ||
    normalized.includes("NETWORK") ||
    normalized.includes("RATE_LIMIT") ||
    normalized.includes("UNAVAILABLE") ||
    normalized.includes("TEMPORARY")
  );
};

const isValidationProviderCode = (code: string) => {
  const normalized = code.toUpperCase();
  return normalized.includes("AUTH") || normalized.includes("CONFLICT") || normalized.includes("VALIDATION");
};

@Injectable()
export class ElectronicBillingProcessingService {
  private readonly processingRefreshAfterMs = readPositiveIntegerEnv(
    "ELECTRONIC_BILLING_BACKGROUND_PROCESSING_REFRESH_AFTER_MS",
    DEFAULT_PROCESSING_REFRESH_AFTER_MS,
  );
  private readonly retryBaseDelayMs = readPositiveIntegerEnv(
    "ELECTRONIC_BILLING_BACKGROUND_RETRY_BASE_DELAY_MS",
    DEFAULT_RETRY_BASE_DELAY_MS,
  );
  private readonly retryBackoffCapMs = readPositiveIntegerEnv(
    "ELECTRONIC_BILLING_BACKGROUND_RETRY_BACKOFF_CAP_MS",
    DEFAULT_RETRY_BACKOFF_CAP_MS,
  );

  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(ElectronicDocumentRepository)
    private readonly documentRepository: ElectronicDocumentRepository,
    @Inject(ElectronicDocumentLineRepository)
    private readonly lineRepository: ElectronicDocumentLineRepository,
    @Inject(ElectronicDocumentTaxRepository)
    private readonly taxRepository: ElectronicDocumentTaxRepository,
    @Inject(ElectronicDocumentReferenceRepository)
    private readonly referenceRepository: ElectronicDocumentReferenceRepository,
    @Inject(ElectronicDocumentEventRepository)
    private readonly eventRepository: ElectronicDocumentEventRepository,
    @Inject(ElectronicBillingProviderResolver)
    private readonly providerResolver: ElectronicBillingProviderResolver,
  ) {}

  async processDocument(tenantId: string, electronicDocumentId: string): Promise<ProcessingResult> {
    return this.runProcessing("PROCESSING_STARTED", tenantId, electronicDocumentId, "process");
  }

  async retryDocument(tenantId: string, electronicDocumentId: string): Promise<ProcessingResult> {
    return this.runProcessing("RETRY_REQUESTED", tenantId, electronicDocumentId, "retry");
  }

  async refreshDocumentStatus(tenantId: string, electronicDocumentId: string): Promise<ProcessingResult> {
    const aggregate = await this.loadAggregate(tenantId, electronicDocumentId);
    if (!aggregate.document) {
      throw new ElectronicDocumentNotProcessableError("Electronic document not found");
    }

    const resolved = await this.providerResolver.resolve({
      tenantId,
      providerConfigId: aggregate.document.provider_config_id,
    });

    const providerResult = await this.getProviderStatus(resolved, aggregate);
    return this.persistProviderResult(tenantId, aggregate, providerResult, resolved, "STATUS_CHANGED", false, this.nextAttemptFromEvents(aggregate.events));
  }

  private async runProcessing(
    claimEventType: ElectronicDocumentEventType,
    tenantId: string,
    electronicDocumentId: string,
    mode: "process" | "retry",
  ): Promise<ProcessingResult> {
    const aggregate = await this.loadAggregate(tenantId, electronicDocumentId);
    if (!aggregate.document) {
      throw new ElectronicDocumentNotProcessableError("Electronic document not found");
    }

    if (mode === "process") {
      if (aggregate.document.status === "PROCESSING") {
        throw new ElectronicDocumentAlreadyProcessingError();
      }
      if (isProcessingTerminalStatus(aggregate.document.status)) {
        return {
          document: aggregate.document,
          lines: aggregate.lines,
          taxes: aggregate.taxes,
          references: aggregate.references,
          events: aggregate.events,
          providerResult: null,
          idempotent: true,
          retryable: false,
        };
      }
      if (!PROCESSABLE_STATUSES.has(aggregate.document.status)) {
        throw new ElectronicDocumentNotProcessableError(`Electronic document status ${aggregate.document.status} is not processable`);
      }
    } else {
      if (aggregate.document.status === "PROCESSING") {
        throw new ElectronicDocumentAlreadyProcessingError();
      }
      if (!RETRYABLE_STATUSES.has(aggregate.document.status)) {
        throw new ElectronicDocumentNotProcessableError("Electronic document can only be retried from TECHNICAL_ERROR");
      }
    }

    const resolved = await this.providerResolver.resolve({
      tenantId,
      providerConfigId: aggregate.document.provider_config_id,
    });

    const claimed = await this.claimDocument(tenantId, electronicDocumentId, claimEventType, aggregate.document.status, aggregate.events);
    if (!claimed) {
      const current = await this.documentRepository.findById(tenantId, electronicDocumentId);
      if (!current) {
        throw new ElectronicDocumentNotProcessableError("Electronic document not found after claim attempt");
      }

      if (current.status === "PROCESSING") {
        throw new ElectronicDocumentAlreadyProcessingError();
      }
      if (isProcessingTerminalStatus(current.status)) {
        const currentAggregate = await this.loadAggregate(tenantId, electronicDocumentId);
        return {
          document: currentAggregate.document,
          lines: currentAggregate.lines,
          taxes: currentAggregate.taxes,
          references: currentAggregate.references,
          events: currentAggregate.events,
          providerResult: null,
          idempotent: true,
          retryable: false,
        };
      }

      throw new ElectronicDocumentStatusTransitionError();
    }

    try {
      const providerResult =
        mode === "process"
          ? await this.issueWithProvider(resolved, aggregate)
          : await this.retryWithProvider(resolved, aggregate);

      return await this.persistProviderResult(
        tenantId,
        aggregate,
        providerResult,
        resolved,
        mode === "process" ? "STATUS_CHANGED" : "STATUS_CHANGED",
        mode === "retry",
        claimed.attempt,
      );
    } catch (error) {
      return await this.persistProviderError(tenantId, aggregate, error, resolved, mode === "retry", claimed.attempt);
    }
  }

  private async loadAggregate(tenantId: string, electronicDocumentId: string): Promise<LoadedAggregate> {
    const document = await this.documentRepository.findById(tenantId, electronicDocumentId);
    if (!document) {
      return {
        document: null as never,
        lines: [],
        taxes: [],
        references: [],
        events: [],
      };
    }

    const [lines, taxes, references, events] = await Promise.all([
      this.lineRepository.findByDocumentId(tenantId, electronicDocumentId),
      this.taxRepository.findByDocumentId(tenantId, electronicDocumentId),
      this.referenceRepository.findByDocumentId(tenantId, electronicDocumentId),
      this.eventRepository.listByDocumentId(tenantId, electronicDocumentId),
    ]);

    return {
      document,
      lines,
      taxes,
      references,
      events,
    };
  }

  private async claimDocument(
    tenantId: string,
    electronicDocumentId: string,
    eventType: ElectronicDocumentEventType,
    currentStatus: ElectronicDocumentStatus,
    events: ElectronicDocumentEventRecord[],
  ): Promise<ClaimedAggregateDocument | null> {
    const client = await this.db.getClient();
    const attempt = this.nextAttemptFromEvents(events);
    try {
      await client.query("BEGIN");
      const claimed = await this.documentRepository.claimForProcessing(
        tenantId,
        electronicDocumentId,
        {
          allowedStatuses: currentStatus === "TECHNICAL_ERROR" ? ["TECHNICAL_ERROR"] : ["PENDING"],
        },
        client,
      );

      if (!claimed) {
        await client.query("ROLLBACK");
        return null;
      }

      await this.eventRepository.append(
        {
          id: randomUUID(),
          electronicDocumentId,
          eventType,
          status: "PROCESSING",
          providerStatus: claimed.provider_status,
          operation: eventType === "RETRY_REQUESTED" ? "RETRY" : "ISSUE",
          attempt,
          metadata: {
            source: "electronic-billing-processing",
            eventType,
          },
          createdAt: new Date(),
        },
        client,
      );

      await client.query("COMMIT");
      return {
        ...claimed,
        attempt,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async issueWithProvider(
    resolved: ResolvedElectronicBillingProvider,
    aggregate: LoadedAggregate,
  ): Promise<ElectronicBillingProviderDocumentResult> {
    if (aggregate.document.document_type === "INVOICE") {
      const command = this.buildInvoiceCommand(aggregate, resolved);
      return resolved.provider.issueInvoice(command);
    }

    if (aggregate.document.document_type === "CREDIT_NOTE") {
      const command = await this.buildCreditNoteCommand(aggregate, resolved);
      return resolved.provider.issueCreditNote(command);
    }

    throw new ElectronicDocumentNotProcessableError(`Document type ${aggregate.document.document_type} is not processable`);
  }

  private async retryWithProvider(
    resolved: ResolvedElectronicBillingProvider,
    aggregate: LoadedAggregate,
  ): Promise<ElectronicBillingProviderStatusResult> {
    if (!aggregate.document.provider_document_id && !aggregate.document.external_reference) {
      throw new ElectronicDocumentNotProcessableError("Electronic document needs provider identity or external reference to retry");
    }

    if (!resolved.provider.retryDocument) {
      throw new ElectronicDocumentNotProcessableError("Provider does not support retry");
    }

    return resolved.provider.retryDocument({
      context: resolved.context,
      documentId: aggregate.document.id,
      providerDocumentId: aggregate.document.provider_document_id ?? null,
      externalReference: aggregate.document.external_reference,
      metadata: aggregate.document.metadata,
      reason: "electronic document retry",
    });
  }

  private async getProviderStatus(
    resolved: ResolvedElectronicBillingProvider,
    aggregate: LoadedAggregate,
  ): Promise<ElectronicBillingProviderStatusResult> {
    if (aggregate.document.provider_document_id) {
      return resolved.provider.getDocumentStatus({
        context: resolved.context,
        documentId: aggregate.document.id,
        providerDocumentId: aggregate.document.provider_document_id,
        externalReference: aggregate.document.external_reference,
        metadata: aggregate.document.metadata,
      });
    }

    return resolved.provider.getDocumentStatus({
      context: resolved.context,
      documentId: aggregate.document.id,
      externalReference: aggregate.document.external_reference,
      metadata: aggregate.document.metadata,
    });
  }

  private buildInvoiceCommand(
    aggregate: LoadedAggregate,
    resolved: ResolvedElectronicBillingProvider,
  ): IssueElectronicInvoiceCommand {
    const snapshot = readBillingSnapshot(aggregate.document.metadata);
    if (!snapshot.customer) {
      throw new ElectronicDocumentNotProcessableError("Invoice customer snapshot is missing");
    }

    return {
      context: resolved.context,
      documentId: aggregate.document.id,
      externalReference: aggregate.document.external_reference,
      issueDate: aggregate.document.issue_date,
      issueTime: aggregate.document.issue_time,
      customer: snapshot.customer,
      payment: snapshot.payment ?? null,
      lines: this.buildLineInputs(aggregate),
      totals: {
        subtotalAmount: aggregate.document.subtotal_amount,
        discountAmount: aggregate.document.discount_amount,
        taxAmount: aggregate.document.tax_amount,
        totalAmount: aggregate.document.total_amount,
        currencyCode: aggregate.document.currency_code,
      },
      metadata: aggregate.document.metadata,
    };
  }

  private async buildCreditNoteCommand(
    aggregate: LoadedAggregate,
    resolved: ResolvedElectronicBillingProvider,
  ): Promise<IssueElectronicCreditNoteCommand> {
    const snapshot = readBillingSnapshot(aggregate.document.metadata);
    if (!snapshot.customer) {
      throw new ElectronicDocumentNotProcessableError("Credit note customer snapshot is missing");
    }

    const originReference = aggregate.references.find((reference) => reference.reference_type === "ORIGIN") ?? aggregate.references[0] ?? null;
    if (!originReference?.referenced_electronic_document_id) {
      throw new ElectronicDocumentNotProcessableError("Credit note origin reference is missing");
    }

    const originalDocument = await this.documentRepository.findById(
      aggregate.document.tenant_id,
      originReference.referenced_electronic_document_id,
    );
    if (!originalDocument) {
      throw new ElectronicDocumentNotProcessableError("Credit note original document not found");
    }
    if (originalDocument.document_type !== "INVOICE") {
      throw new ElectronicDocumentNotProcessableError("Credit note original document must be an invoice");
    }

    const originalLines = await this.lineRepository.findByDocumentId(aggregate.document.tenant_id, originalDocument.id);
    const originalLineById = new Map(originalLines.map((line) => [line.id, line]));

    const lines = aggregate.lines.map((line) => {
      const lineSnapshot = readLineSnapshot(line.metadata);
      const originalLineId = lineSnapshot.originalElectronicDocumentLineId ?? null;
      const providerOriginalLineId =
        lineSnapshot.providerOriginalLineId ??
        (originalLineId ? originalLineById.get(originalLineId)?.provider_line_id ?? null : null);

      return {
        sourceLineId: line.source_line_id,
        originalElectronicDocumentLineId: originalLineId,
        providerOriginalLineId,
        sku: line.sku,
        description: line.description,
        quantity: line.quantity,
        unitCode: line.unit_code,
        unitPrice: line.unit_price,
        discountAmount: line.discount_amount,
        subtotalAmount: line.subtotal_amount,
        taxAmount: line.tax_amount,
        totalAmount: line.total_amount,
        taxTreatment: line.tax_treatment,
        taxes: this.buildLineTaxes(aggregate, line.id),
        metadata: line.metadata,
      };
    });

    return {
      context: resolved.context,
      documentId: aggregate.document.id,
      externalReference: aggregate.document.external_reference,
      issueDate: aggregate.document.issue_date,
      issueTime: aggregate.document.issue_time,
      customer: snapshot.customer,
      payment: snapshot.payment ?? null,
      originalDocument: {
        internalDocumentId: originalDocument.id,
        providerDocumentId: originalDocument.provider_document_id,
        externalReference: originalDocument.external_reference,
        fullNumber: originalDocument.full_number,
      },
      reason: {
        reasonCode: originReference.reason_code,
        reasonDescription: originReference.reason_description,
        reasonType: originReference.reference_type,
        metadata: originReference.metadata,
      },
      lines,
      totals: {
        subtotalAmount: aggregate.document.subtotal_amount,
        discountAmount: aggregate.document.discount_amount,
        taxAmount: aggregate.document.tax_amount,
        totalAmount: aggregate.document.total_amount,
        currencyCode: aggregate.document.currency_code,
      },
      metadata: aggregate.document.metadata,
    };
  }

  private buildLineInputs(aggregate: LoadedAggregate) {
    const taxesByLineId = new Map<string, ElectronicDocumentTaxRecord[]>();
    for (const tax of aggregate.taxes) {
      if (!tax.electronic_document_line_id) {
        continue;
      }
      const current = taxesByLineId.get(tax.electronic_document_line_id) ?? [];
      current.push(tax);
      taxesByLineId.set(tax.electronic_document_line_id, current);
    }

    return aggregate.lines.map((line) => ({
      sourceLineId: line.source_line_id,
      originalElectronicDocumentLineId: readLineSnapshot(line.metadata).originalElectronicDocumentLineId ?? null,
      providerOriginalLineId: readLineSnapshot(line.metadata).providerOriginalLineId ?? null,
      sku: line.sku,
      description: line.description,
      quantity: line.quantity,
      unitCode: line.unit_code,
      unitPrice: line.unit_price,
      discountAmount: line.discount_amount,
      subtotalAmount: line.subtotal_amount,
      taxAmount: line.tax_amount,
      totalAmount: line.total_amount,
      taxTreatment: line.tax_treatment,
      taxes: (taxesByLineId.get(line.id) ?? []).map((tax) => ({
        type: tax.tax_type,
        code: tax.tax_code,
        schemeId: tax.tax_scheme_id,
        schemeName: tax.tax_scheme_name,
        rate: tax.rate,
        taxableBase: tax.taxable_base,
        amount: tax.tax_amount,
        metadata: tax.metadata,
      })),
      metadata: line.metadata,
    }));
  }

  private buildLineTaxes(aggregate: LoadedAggregate, lineId: string) {
    return aggregate.taxes
      .filter((tax) => tax.electronic_document_line_id === lineId)
      .map((tax) => ({
        type: tax.tax_type,
        code: tax.tax_code,
        schemeId: tax.tax_scheme_id,
        schemeName: tax.tax_scheme_name,
        rate: tax.rate,
        taxableBase: tax.taxable_base,
        amount: tax.tax_amount,
        metadata: tax.metadata,
      }));
  }

  private async persistProviderResult(
    tenantId: string,
    aggregate: LoadedAggregate,
    providerResult: ElectronicBillingProviderDocumentResult | ElectronicBillingProviderStatusResult,
    resolved: ResolvedElectronicBillingProvider,
    eventType: ElectronicDocumentEventType,
    isRetry: boolean,
    attempt: number,
  ): Promise<ProcessingResult> {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const currentDocument = await this.documentRepository.findById(tenantId, aggregate.document.id, client);
      if (!currentDocument) {
        throw new ElectronicDocumentNotProcessableError("Electronic document disappeared during persistence");
      }

      if (
        currentDocument.provider_document_id &&
        providerResult.providerDocumentId &&
        currentDocument.provider_document_id !== providerResult.providerDocumentId
      ) {
        throw new ElectronicDocumentProviderResultConflictError();
      }

      const normalizedStatus = providerResult.normalizedStatus ?? currentDocument.status;
      const statusChanged = currentDocument.status !== normalizedStatus;
      const sentAt = this.resolveSentAt(currentDocument, providerResult);
      const acceptedAt = this.resolveAcceptedAt(providerResult);
      const rejectedAt = this.resolveRejectedAt(providerResult);
      const nextStatusCheckAt = this.resolveNextStatusCheckAt(normalizedStatus, attempt);

      await this.documentRepository.updateProviderIdentity(
        tenantId,
        aggregate.document.id,
        {
          providerDocumentId: providerResult.providerDocumentId ?? currentDocument.provider_document_id ?? null,
          prefix: providerResult.prefix ?? currentDocument.prefix,
          number: providerResult.number ?? currentDocument.number,
          fullNumber: providerResult.fullNumber ?? currentDocument.full_number,
          cufe: providerResult.cufe ?? currentDocument.cufe,
          cude: providerResult.cude ?? currentDocument.cude,
          providerStatus: providerResult.providerStatus,
          providerStatusDetail: providerResult.providerStatusDetail ?? null,
          lastStatusCheckAt: nextStatusCheckAt,
        },
        client,
      );

      await this.documentRepository.updateStatus(
        tenantId,
        aggregate.document.id,
        {
          status: normalizedStatus,
          providerStatus: providerResult.providerStatus,
          providerStatusDetail: providerResult.providerStatusDetail ?? null,
          sentAt: sentAt ?? undefined,
          acceptedAt: acceptedAt ?? undefined,
          rejectedAt: rejectedAt ?? undefined,
          lastStatusCheckAt: nextStatusCheckAt,
        },
        client,
      );

      await this.documentRepository.updateError(
        tenantId,
        aggregate.document.id,
        {
          lastErrorCode: null,
          lastErrorMessage: null,
        },
        client,
      );

      await this.persistProviderLineIds(tenantId, aggregate, providerResult, client);

      if (statusChanged) {
        await this.eventRepository.append(
          {
            id: randomUUID(),
            electronicDocumentId: aggregate.document.id,
            eventType,
            status: normalizedStatus,
            providerStatus: providerResult.providerStatus,
            operation: isRetry ? "RETRY" : "ISSUE",
            attempt,
            httpStatus: null,
            errorCode: null,
            errorMessage: null,
            metadata: {
              source: "electronic-billing-processing",
              providerCode: resolved.provider.code,
              providerStatus: providerResult.providerStatus,
              normalizedStatus,
            },
            createdAt: new Date(),
          },
          client,
        );
      }

      await client.query("COMMIT");
      const refreshed = await this.loadAggregate(tenantId, aggregate.document.id);
      return {
        document: refreshed.document,
        lines: refreshed.lines,
        taxes: refreshed.taxes,
        references: refreshed.references,
        events: refreshed.events,
        providerResult,
        idempotent: false,
        retryable: false,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async persistProviderError(
    tenantId: string,
    aggregate: LoadedAggregate,
    error: unknown,
    resolved: ResolvedElectronicBillingProvider,
    isRetry: boolean,
    attempt: number,
  ): Promise<ProcessingResult> {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const currentDocument = await this.documentRepository.findById(tenantId, aggregate.document.id, client);
      if (!currentDocument) {
        throw new ElectronicDocumentNotProcessableError("Electronic document disappeared during failure persistence");
      }

      const classification = this.classifyError(error);
      const status = classification.rejected ? "REJECTED" : "TECHNICAL_ERROR";
      const message = error instanceof Error ? error.message : "Unknown provider error";
      const code = this.readErrorCode(error);
      const nextStatusCheckAt = this.resolveNextStatusCheckAt(status, attempt);

      await this.documentRepository.updateStatus(
        tenantId,
        aggregate.document.id,
        {
          status,
          providerStatus: currentDocument.provider_status,
          providerStatusDetail: message,
          lastStatusCheckAt: nextStatusCheckAt,
        },
        client,
      );

      await this.documentRepository.updateError(
        tenantId,
        aggregate.document.id,
        {
          lastErrorCode: code,
          lastErrorMessage: message,
        },
        client,
      );

      await this.eventRepository.append(
        {
          id: randomUUID(),
          electronicDocumentId: aggregate.document.id,
          eventType: status === "REJECTED" ? "REJECTED" : "TECHNICAL_ERROR",
          status,
          providerStatus: currentDocument.provider_status,
          operation: isRetry ? "RETRY" : "ISSUE",
          attempt,
          httpStatus: null,
          errorCode: code,
          errorMessage: message,
          metadata: {
            source: "electronic-billing-processing",
            providerCode: resolved.provider.code,
            retryable: classification.retryable,
          },
          createdAt: new Date(),
        },
        client,
      );

      await client.query("COMMIT");
      const refreshed = await this.loadAggregate(tenantId, aggregate.document.id);
      return {
        document: refreshed.document,
        lines: refreshed.lines,
        taxes: refreshed.taxes,
        references: refreshed.references,
        events: refreshed.events,
        providerResult: null,
        idempotent: false,
        retryable: classification.retryable,
      };
    } catch (persistError) {
      await client.query("ROLLBACK");
      throw persistError;
    } finally {
      client.release();
    }
  }

  private async persistProviderLineIds(
    tenantId: string,
    aggregate: LoadedAggregate,
    providerResult: ElectronicBillingProviderDocumentResult | ElectronicBillingProviderStatusResult,
    client: Awaited<ReturnType<DatabaseService["getClient"]>>,
  ) {
    const lineResults = readLineResults(providerResult.metadata ?? {});
    if (lineResults.length === 0) {
      return;
    }

    for (const lineResult of lineResults) {
      if (!lineResult.providerLineId) {
        continue;
      }

      const byIndex = typeof lineResult.index === "number" ? aggregate.lines[lineResult.index] ?? null : null;
      const byOriginLineId =
        lineResult.originLineId
          ? aggregate.lines.find((line) => {
              const snapshot = readLineSnapshot(line.metadata);
              return (
                line.source_line_id === lineResult.originLineId ||
                snapshot.originalElectronicDocumentLineId === lineResult.originLineId ||
                snapshot.providerOriginalLineId === lineResult.originLineId
              );
            }) ?? null
          : null;
      const currentLine = byOriginLineId ?? byIndex ?? null;
      if (!currentLine) {
        continue;
      }

      if (currentLine.provider_line_id === lineResult.providerLineId) {
        continue;
      }

      await this.lineRepository.updateProviderLineId(
        tenantId,
        currentLine.id,
        lineResult.providerLineId,
        client,
      );
    }
  }

  private resolveSentAt(
    currentDocument: ElectronicDocumentRecord,
    providerResult: ElectronicBillingProviderDocumentResult | ElectronicBillingProviderStatusResult,
  ) {
    if (providerResult.acceptedAt || providerResult.rejectedAt) {
      return currentDocument.sent_at ?? new Date();
    }

    if (providerResult.providerStatus?.toUpperCase() === "SENT") {
      return currentDocument.sent_at ?? new Date();
    }

    return undefined;
  }

  private resolveAcceptedAt(
    providerResult: ElectronicBillingProviderDocumentResult | ElectronicBillingProviderStatusResult,
  ) {
    if (providerResult.acceptedAt) {
      return providerResult.acceptedAt;
    }

    return providerResult.normalizedStatus === "ACCEPTED" ? new Date() : undefined;
  }

  private resolveRejectedAt(
    providerResult: ElectronicBillingProviderDocumentResult | ElectronicBillingProviderStatusResult,
  ) {
    if (providerResult.rejectedAt) {
      return providerResult.rejectedAt;
    }

    return providerResult.normalizedStatus === "REJECTED" ? new Date() : undefined;
  }

  private resolveNextStatusCheckAt(status: ElectronicDocumentStatus, attempt: number) {
    if (status === "PROCESSING") {
      return new Date(Date.now() + this.processingRefreshAfterMs);
    }

    if (status === "TECHNICAL_ERROR") {
      return new Date(Date.now() + this.computeRetryDelayMs(attempt));
    }

    return new Date();
  }

  private computeRetryDelayMs(attempt: number) {
    const normalizedAttempt = Math.max(1, attempt);
    const rawDelay = this.retryBaseDelayMs * Math.pow(2, normalizedAttempt - 1);
    return Math.min(rawDelay, this.retryBackoffCapMs);
  }

  private classifyError(error: unknown) {
    const code = this.readErrorCode(error).toUpperCase();
    if (isValidationProviderCode(code)) {
      return { rejected: true, retryable: false };
    }

    if (isRetryableProviderCode(code)) {
      return { rejected: false, retryable: true };
    }

    return { rejected: false, retryable: false };
  }

  private readErrorCode(error: unknown) {
    if (error instanceof ElectronicBillingProviderError) {
      return error.code;
    }

    if (error instanceof Error && typeof error.name === "string" && error.name.trim().length > 0) {
      return error.name;
    }

    return "ELECTRONIC_BILLING_UNKNOWN_ERROR";
  }

  private nextAttemptFromEvents(events: ElectronicDocumentEventRecord[]) {
    const latestAttempt = events.reduce((max, event) => Math.max(max, event.attempt ?? 0), 0);
    return latestAttempt + 1;
  }
}
