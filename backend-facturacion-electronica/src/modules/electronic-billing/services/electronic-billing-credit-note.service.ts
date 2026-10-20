import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  ElectronicCustomer,
  ElectronicPayment,
  IssueElectronicCreditNoteCommand,
} from "../contracts/electronic-billing-commands";
import type { ElectronicDocumentOutcome } from "../domain/electronic-billing-failure";
import { ElectronicBillingProviderResolver } from "../providers/electronic-billing-provider-resolver";
import type {
  ElectronicDocumentLineRecord,
  ElectronicDocumentRecord,
  ElectronicDocumentTaxRecord,
} from "../repositories/electronic-billing-records";
import {
  ElectronicDocumentLineRepository,
  ElectronicDocumentRepository,
  ElectronicDocumentTaxRepository,
} from "../repositories/electronic-billing.repositories";
import { ElectronicBillingFailureService } from "./electronic-billing-failure.service";
import { ElectronicBillingProcessingService } from "./electronic-billing-processing.service";
import { ElectronicBillingService } from "./electronic-billing.service";

export type IssueCreditNoteForInvoiceInput = {
  tenantId: string;
  discrepancyResponseCode?: string | null;
  discrepancyResponseDescription?: string | null;
  noteReason?: string | null;
};

export class ElectronicCreditNoteInvoiceNotFoundError extends Error {
  constructor() {
    super("Factura electrónica origen no encontrada");
    this.name = "ElectronicCreditNoteInvoiceNotFoundError";
  }
}

export class ElectronicCreditNoteInvoiceNotAcceptedError extends Error {
  constructor(status: string) {
    super(`La factura electrónica origen no está aceptada por la DIAN (estado ${status})`);
    this.name = "ElectronicCreditNoteInvoiceNotAcceptedError";
  }
}

const MAX_REISSUE_ATTEMPTS = 10;
const DEFAULT_DISCREPANCY_CODE = "2";
const DEFAULT_DISCREPANCY_DESCRIPTION = "Anulación de factura electrónica";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const trimToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const buildCreditNoteExternalReference = (invoiceExternalReference: string, attempt: number) =>
  attempt <= 1 ? `CN-${invoiceExternalReference}` : `CN-${invoiceExternalReference}-${attempt}`;

@Injectable()
export class ElectronicBillingCreditNoteService {
  constructor(
    @Inject(ElectronicDocumentRepository)
    private readonly documentRepository: ElectronicDocumentRepository,
    @Inject(ElectronicDocumentLineRepository)
    private readonly lineRepository: ElectronicDocumentLineRepository,
    @Inject(ElectronicDocumentTaxRepository)
    private readonly taxRepository: ElectronicDocumentTaxRepository,
    @Inject(ElectronicBillingProviderResolver)
    private readonly providerResolver: ElectronicBillingProviderResolver,
    @Inject(ElectronicBillingService)
    private readonly billingService: ElectronicBillingService,
    @Inject(ElectronicBillingProcessingService)
    private readonly processingService: ElectronicBillingProcessingService,
    @Inject(ElectronicBillingFailureService)
    private readonly failureService: ElectronicBillingFailureService,
  ) {}

  /**
   * Issues (or resumes) the full-reversal credit note of an accepted invoice and
   * waits for the fiscal result. A rejected credit note allows a new attempt with
   * the next deterministic external reference, never a parallel duplicate.
   */
  async issueForInvoice(
    invoiceDocumentId: string,
    input: IssueCreditNoteForInvoiceInput,
  ): Promise<ElectronicDocumentOutcome> {
    const invoice = await this.documentRepository.findById(input.tenantId, invoiceDocumentId);
    if (!invoice || invoice.document_type !== "INVOICE") {
      throw new ElectronicCreditNoteInvoiceNotFoundError();
    }
    if (invoice.status !== "ACCEPTED") {
      throw new ElectronicCreditNoteInvoiceNotAcceptedError(invoice.status);
    }

    const resolved = await this.providerResolver.resolve({ tenantId: input.tenantId });

    for (let attempt = 1; attempt <= MAX_REISSUE_ATTEMPTS; attempt += 1) {
      const externalReference = buildCreditNoteExternalReference(invoice.external_reference, attempt);
      const existing = await this.documentRepository.findByExternalReference(
        input.tenantId,
        "CREDIT_NOTE",
        externalReference,
        resolved.context.providerId,
      );

      if (existing?.status === "REJECTED" && existing.provider_document_id) {
        continue;
      }

      if (existing && existing.status !== "PENDING" && existing.status !== "REJECTED") {
        return this.resumeExisting(existing);
      }

      const command = await this.buildCommand(invoice, resolved.context, externalReference, input);
      const aggregate = await this.billingService.createCreditNoteDocument(command, undefined, {
        type: "RETURN",
        id: invoice.source_id,
      });
      if (!aggregate.document) {
        throw new ElectronicCreditNoteInvoiceNotFoundError();
      }
      return this.processAndDescribe(input.tenantId, aggregate.document.id);
    }

    throw new ElectronicCreditNoteInvoiceNotAcceptedError("MAX_CREDIT_NOTE_ATTEMPTS");
  }

  private async resumeExisting(existing: ElectronicDocumentRecord) {
    if (existing.status === "TECHNICAL_ERROR") {
      try {
        const decision = await this.processingService.evaluateRetryability(existing.tenant_id, existing.id);
        if (decision.canRetry) {
          await this.processingService.retryRecoverableDocument(existing.tenant_id, existing.id);
        }
      } catch (error) {
        console.warn("electronic_billing.credit_note.retry_failed", {
          tenantId: existing.tenant_id,
          electronicDocumentId: existing.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return this.describeOrThrow(existing.tenant_id, existing.id);
  }

  private async processAndDescribe(tenantId: string, electronicDocumentId: string) {
    try {
      await this.processingService.processDocument(tenantId, electronicDocumentId);
    } catch (error) {
      console.warn("electronic_billing.credit_note.process_failed", {
        tenantId,
        electronicDocumentId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return this.describeOrThrow(tenantId, electronicDocumentId);
  }

  private async describeOrThrow(tenantId: string, electronicDocumentId: string) {
    const outcome = await this.failureService.describe(tenantId, electronicDocumentId);
    if (!outcome) {
      throw new ElectronicCreditNoteInvoiceNotFoundError();
    }
    return outcome;
  }

  private async buildCommand(
    invoice: ElectronicDocumentRecord,
    context: IssueElectronicCreditNoteCommand["context"],
    externalReference: string,
    input: IssueCreditNoteForInvoiceInput,
  ): Promise<IssueElectronicCreditNoteCommand> {
    const [lines, taxes] = await Promise.all([
      this.lineRepository.findByDocumentId(invoice.tenant_id, invoice.id),
      this.taxRepository.findByDocumentId(invoice.tenant_id, invoice.id),
    ]);
    const billingMetadata = invoice.metadata?.electronicBilling;
    const snapshot = isRecord(billingMetadata) ? billingMetadata : {};
    const customer = snapshot.customer as ElectronicCustomer | undefined;
    if (!customer) {
      throw new ElectronicCreditNoteInvoiceNotFoundError();
    }
    const payments = Array.isArray(snapshot.payments) ? snapshot.payments as ElectronicPayment[] : null;
    const payment = isRecord(snapshot.payment) ? snapshot.payment as ElectronicPayment : null;
    const reasonCode = trimToNull(input.discrepancyResponseCode) ?? DEFAULT_DISCREPANCY_CODE;
    const reasonDescription = trimToNull(input.discrepancyResponseDescription)
      ?? trimToNull(input.noteReason)
      ?? DEFAULT_DISCREPANCY_DESCRIPTION;
    const noteReason = trimToNull(input.noteReason) ?? reasonDescription;

    return {
      context,
      documentId: randomUUID(),
      externalReference,
      issueDate: null,
      issueTime: null,
      customer,
      payments: payments ?? (payment ? [payment] : []),
      payment,
      lines: lines.map((line) => this.mapLine(line, taxes)),
      totals: {
        subtotalAmount: invoice.subtotal_amount,
        discountAmount: invoice.discount_amount,
        taxAmount: invoice.tax_amount,
        totalAmount: invoice.total_amount,
        currencyCode: invoice.currency_code,
      },
      originalDocument: {
        internalDocumentId: invoice.id,
        providerDocumentId: invoice.provider_document_id,
        externalReference: invoice.external_reference,
        fullNumber: invoice.full_number,
      },
      reason: {
        reasonCode,
        reasonDescription,
        reasonType: "SALE_VOID",
        metadata: { noteReason },
      },
      metadata: {
        source: "sale-void",
        saleId: invoice.source_id,
        invoiceElectronicDocumentId: invoice.id,
        noteReason,
      },
    };
  }

  private mapLine(line: ElectronicDocumentLineRecord, taxes: ElectronicDocumentTaxRecord[]) {
    const lineMetadata = line.metadata?.electronicBilling;
    const lineSnapshot = isRecord(lineMetadata) ? lineMetadata : {};
    return {
      sourceLineId: line.source_line_id,
      originalElectronicDocumentLineId: line.id,
      providerOriginalLineId: line.provider_line_id,
      standardItemId: trimToNull(lineSnapshot.standardItemId),
      standardItemSchemeId: trimToNull(lineSnapshot.standardItemSchemeId),
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
      beverageCategory: (lineSnapshot.beverageCategory as "LIQUOR" | "WINE" | "APERITIF" | "BEER" | null | undefined) ?? null,
      volumeMilliliters: (lineSnapshot.volumeMilliliters as number | string | null | undefined) ?? null,
      alcoholDegrees: (lineSnapshot.alcoholDegrees as number | string | null | undefined) ?? null,
      publicSalePriceBeforeTaxes: (lineSnapshot.publicSalePriceBeforeTaxes as number | string | null | undefined) ?? null,
      taxes: taxes
        .filter((tax) => tax.electronic_document_line_id === line.id)
        .map((tax) => ({
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
    };
  }
}
