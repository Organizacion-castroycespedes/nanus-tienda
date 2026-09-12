import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../database/database.service";
import {
  ElectronicDocumentConflictError,
  ElectronicDocumentEventRepository,
  ElectronicDocumentLineRepository,
  ElectronicDocumentReferenceRepository,
  ElectronicDocumentRepository,
  ElectronicDocumentTaxRepository,
} from "../repositories/electronic-billing.repositories";
import type {
  ElectronicBillingProviderContext,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
} from "../contracts/electronic-billing-commands";
import type {
  ElectronicDocumentStatus,
  ElectronicDocumentSourceType,
  ElectronicDocumentType,
} from "../repositories/electronic-billing-records";
import {
  buildProcessingState,
  ELECTRONIC_BILLING_PROCESSING_STATE_KEY,
} from "../contracts/processing-state";

export class ElectronicDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElectronicDocumentValidationError";
  }
}

export class ElectronicDocumentOriginalNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElectronicDocumentOriginalNotFoundError";
  }
}

export class ElectronicDocumentTenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElectronicDocumentTenantMismatchError";
  }
}

export type ElectronicDocumentAggregateResult = {
  document: Awaited<ReturnType<ElectronicDocumentRepository["create"]>>;
  lines: Awaited<ReturnType<ElectronicDocumentLineRepository["insertMany"]>>;
  taxes: Awaited<ReturnType<ElectronicDocumentTaxRepository["insertMany"]>>;
  references: Awaited<ReturnType<ElectronicDocumentReferenceRepository["create"]>>[];
  events: Awaited<ReturnType<ElectronicDocumentEventRepository["append"]>>[];
  idempotent: boolean;
};

type AggregateCommand = IssueElectronicInvoiceCommand | IssueElectronicCreditNoteCommand;

type DocumentSourceInput = {
  type?: ElectronicDocumentSourceType;
  id?: string | null;
};

type CreateDocumentInput = {
  tenantId: string;
  providerId: string;
  providerConfigId: string;
  documentType: ElectronicDocumentType;
  sourceType: ElectronicDocumentSourceType;
  sourceId: string | null;
  externalReference: string;
  providerDocumentId: string | null;
  prefix: string | null;
  number: string | number | null;
  fullNumber: string | null;
  status: ElectronicDocumentStatus;
  providerStatus: string | null;
  providerStatusDetail: string | null;
  cufe: string | null;
  cude: string | null;
  currencyCode: string;
  subtotalAmount: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  issueDate: Date | string | null;
  issueTime: string | null;
  metadata: Record<string, unknown>;
};

const toDateValue = (value: Date | string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
};

const normalizeNumber = (value: number | string) => (typeof value === "number" ? value : Number(value));

const getDocumentId = () => randomUUID();

const buildBillingSnapshotMetadata = (command: AggregateCommand) => ({
  customer: command.customer,
  payment: command.payment ?? null,
});

const buildLineSnapshotMetadata = (
  line: AggregateCommand["lines"][number],
) => ({
  ...(line.metadata ?? {}),
  electronicBilling: {
    sourceLineId: line.sourceLineId ?? null,
    originalElectronicDocumentLineId: line.originalElectronicDocumentLineId ?? null,
    providerOriginalLineId: line.providerOriginalLineId ?? null,
  },
});

@Injectable()
export class ElectronicBillingService {
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
  ) {}

  async createInvoiceDocument(
    command: IssueElectronicInvoiceCommand,
    clientOverride?: PoolClient,
    source?: DocumentSourceInput,
  ): Promise<ElectronicDocumentAggregateResult> {
    return this.createAggregate("INVOICE", command, clientOverride, source);
  }

  async createCreditNoteDocument(
    command: IssueElectronicCreditNoteCommand,
    clientOverride?: PoolClient,
    source?: DocumentSourceInput,
  ): Promise<ElectronicDocumentAggregateResult> {
    return this.createAggregate("CREDIT_NOTE", command, clientOverride, source);
  }

  private validateAggregateCommand(command: AggregateCommand) {
    if (command.lines.length === 0) {
      throw new ElectronicDocumentValidationError("Electronic document needs at least one line");
    }
    if (normalizeNumber(command.totals.totalAmount) < 0) {
      throw new ElectronicDocumentValidationError("Electronic document total must be positive");
    }
    for (const line of command.lines) {
      if (normalizeNumber(line.quantity) <= 0) {
        throw new ElectronicDocumentValidationError("Electronic document line quantity must be positive");
      }
      if (normalizeNumber(line.unitPrice) < 0 || normalizeNumber(line.totalAmount) < 0) {
        throw new ElectronicDocumentValidationError("Electronic document amounts must be positive");
      }
    }
  }

  private buildDocumentInput(
    documentType: ElectronicDocumentType,
    command: AggregateCommand,
    providerContext: ElectronicBillingProviderContext,
    source?: DocumentSourceInput,
  ): CreateDocumentInput {
    const defaultSourceType: ElectronicDocumentSourceType =
      documentType === "INVOICE" ? "SALE" : "RETURN";
    return {
      tenantId: providerContext.tenantId,
      providerId: providerContext.providerId,
      providerConfigId: providerContext.providerConfigId,
      documentType,
      sourceType: source?.type ?? defaultSourceType,
      sourceId: source?.id ?? null,
      externalReference: command.externalReference,
      providerDocumentId: null,
      prefix: null,
      number: null,
      fullNumber: null,
      status: "PENDING",
      providerStatus: null,
      providerStatusDetail: null,
      cufe: null,
      cude: null,
      currencyCode: command.totals.currencyCode,
      subtotalAmount: command.totals.subtotalAmount,
      discountAmount: command.totals.discountAmount,
      taxAmount: command.totals.taxAmount,
      totalAmount: command.totals.totalAmount,
      issueDate: toDateValue(command.issueDate) ?? null,
      issueTime: command.issueTime ?? null,
      metadata: {
        ...(command.metadata ?? {}),
        electronicBilling: buildBillingSnapshotMetadata(command),
        [ELECTRONIC_BILLING_PROCESSING_STATE_KEY]: buildProcessingState("PRE_PROVIDER_CREATE"),
      },
    };
  }

  private async createAggregate(
    documentType: ElectronicDocumentType,
    command: AggregateCommand,
    clientOverride?: PoolClient,
    source?: DocumentSourceInput,
  ): Promise<ElectronicDocumentAggregateResult> {
    this.validateAggregateCommand(command);

    const providerContext = command.context;
    const client = clientOverride ?? (await this.db.getClient());
    const ownsClient = clientOverride === undefined;
    try {
      if (ownsClient) {
        await client.query("BEGIN");
      }

      const existing = await this.documentRepository.findByExternalReference(
        providerContext.tenantId,
        documentType,
        command.externalReference,
        providerContext.providerId,
        client,
      );
      if (existing) {
        const lines = await this.lineRepository.findByDocumentId(
          providerContext.tenantId,
          existing.id,
          client,
        );
        const taxes = await this.taxRepository.findByDocumentId(
          providerContext.tenantId,
          existing.id,
          client,
        );
        const references = await this.referenceRepository.findByDocumentId(
          providerContext.tenantId,
          existing.id,
          client,
        );
        const events = await this.eventRepository.listByDocumentId(
          providerContext.tenantId,
          existing.id,
          client,
        );

        if (ownsClient) {
          await client.query("COMMIT");
        }
        return {
          document: existing,
          lines,
          taxes,
          references,
          events,
          idempotent: true,
        };
      }

      const documentId = getDocumentId();
      const document = await this.documentRepository.create(
        {
          id: documentId,
          tenantId: providerContext.tenantId,
          providerId: providerContext.providerId,
          providerConfigId: providerContext.providerConfigId,
          documentType,
          sourceType: source?.type ?? (documentType === "INVOICE" ? "SALE" : "RETURN"),
          sourceId: source?.id ?? null,
          externalReference: command.externalReference,
          providerDocumentId: null,
          prefix: null,
          number: null,
          fullNumber: null,
          status: "PENDING",
          providerStatus: null,
          providerStatusDetail: null,
          cufe: null,
          cude: null,
          currencyCode: command.totals.currencyCode,
          subtotalAmount: command.totals.subtotalAmount,
          discountAmount: command.totals.discountAmount,
          taxAmount: command.totals.taxAmount,
          totalAmount: command.totals.totalAmount,
          issueDate: command.issueDate ?? null,
          issueTime: command.issueTime ?? null,
          metadata: {
            ...(command.metadata ?? {}),
            electronicBilling: buildBillingSnapshotMetadata(command),
            [ELECTRONIC_BILLING_PROCESSING_STATE_KEY]: buildProcessingState("PRE_PROVIDER_CREATE"),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        client,
      );
      if (!document) {
        throw new ElectronicDocumentValidationError("Electronic document insert failed");
      }

      const sourceLineType: ElectronicDocumentSourceType =
        documentType === "INVOICE" ? "SALE" : "RETURN";

      const lineInputs = command.lines.map((line, index) => ({
        id: randomUUID(),
        electronicDocumentId: document.id,
        sourceLineType,
        sourceLineId: line.sourceLineId ?? null,
        providerLineId: null,
        sku: line.sku ?? null,
        description: line.description,
        quantity: line.quantity,
        unitCode: line.unitCode ?? null,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount ?? 0,
        subtotalAmount: line.subtotalAmount,
        taxAmount: line.taxAmount,
        totalAmount: line.totalAmount,
        taxTreatment: line.taxTreatment ?? null,
        metadata: buildLineSnapshotMetadata(line),
        createdAt: new Date(Date.now() + index),
        updatedAt: new Date(Date.now() + index),
      }));
      const lines = await this.lineRepository.insertMany(lineInputs, client);

      const taxInputs = command.lines.flatMap((line, lineIndex) =>
        (line.taxes ?? []).map((tax) => ({
          id: randomUUID(),
          electronicDocumentId: document.id,
          electronicDocumentLineId: lines[lineIndex]?.id ?? null,
          taxType: tax.type,
          taxCode: tax.code ?? null,
          taxSchemeId: tax.schemeId ?? null,
          taxSchemeName: tax.schemeName ?? null,
          rate: tax.rate,
          taxableBase: tax.taxableBase,
          taxAmount: tax.amount,
          metadata: tax.metadata ?? {},
          createdAt: new Date(),
        })),
      );
      const taxes = await this.taxRepository.insertMany(taxInputs, client);

      const references = [] as Awaited<ReturnType<ElectronicDocumentReferenceRepository["create"]>>[];
      if (documentType === "CREDIT_NOTE") {
        const creditNoteCommand = command as IssueElectronicCreditNoteCommand;
        const original = await this.documentRepository.findById(
          providerContext.tenantId,
          creditNoteCommand.originalDocument.internalDocumentId ?? "",
          client,
        );
        if (!original) {
          throw new ElectronicDocumentOriginalNotFoundError("Original electronic document not found");
        }
        if (original.document_type !== "INVOICE") {
          throw new ElectronicDocumentValidationError("Original electronic document must be an invoice");
        }

        const originalLines = await this.lineRepository.findByDocumentId(
          providerContext.tenantId,
          original.id,
          client,
        );
        const originalLineIds = new Set(originalLines.map((line) => line.id));
        for (const line of creditNoteCommand.lines) {
          if (line.originalElectronicDocumentLineId && !originalLineIds.has(line.originalElectronicDocumentLineId)) {
            throw new ElectronicDocumentTenantMismatchError(
              "Credit note original line must belong to the same tenant document",
            );
          }
        }

        references.push(
          await this.referenceRepository.create(
            {
              id: randomUUID(),
              electronicDocumentId: document.id,
              referencedElectronicDocumentId: original.id,
              referenceType: "ORIGIN",
              providerReferencedDocumentId: creditNoteCommand.originalDocument.providerDocumentId ?? null,
              referenceNumber: creditNoteCommand.originalDocument.fullNumber ?? null,
              externalReference: creditNoteCommand.originalDocument.externalReference ?? null,
              reasonCode: creditNoteCommand.reason.reasonCode ?? null,
              reasonDescription: creditNoteCommand.reason.reasonDescription ?? null,
              metadata: creditNoteCommand.reason.metadata ?? {},
              createdAt: new Date(),
            },
            client,
          ),
        );
      }

      const events = [
        await this.eventRepository.append(
          {
            id: randomUUID(),
            electronicDocumentId: document.id,
            eventType: "DOCUMENT_CREATED",
            status: "PENDING",
            providerStatus: null,
            operation: "CREATE",
            attempt: 1,
            metadata: command.metadata ?? {},
            createdAt: new Date(),
          },
          client,
        ),
      ];

      if (ownsClient) {
        await client.query("COMMIT");
      }
      return {
        document,
        lines,
        taxes,
        references,
        events,
        idempotent: false,
      };
    } catch (error) {
      if (ownsClient) {
        await client.query("ROLLBACK");
      }
      if (ownsClient && error instanceof ElectronicDocumentConflictError) {
        const existing = await this.documentRepository.findByExternalReference(
          command.context.tenantId,
          documentType,
          command.externalReference,
          command.context.providerId,
        );
        if (existing) {
          return {
            document: existing,
            lines: await this.lineRepository.findByDocumentId(command.context.tenantId, existing.id),
            taxes: await this.taxRepository.findByDocumentId(command.context.tenantId, existing.id),
            references: await this.referenceRepository.findByDocumentId(command.context.tenantId, existing.id),
            events: await this.eventRepository.listByDocumentId(command.context.tenantId, existing.id),
            idempotent: true,
          };
        }
      }
      throw error;
    } finally {
      if (ownsClient) {
        client.release();
      }
    }
  }
}
