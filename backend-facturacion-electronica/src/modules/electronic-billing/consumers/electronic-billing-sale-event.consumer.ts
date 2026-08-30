import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseService } from "../../database/database.service";
import {
  ElectronicBillingProviderDisabledError,
} from "../contracts/electronic-billing-errors";
import {
  buildDeterministicSaleExternalReference,
  buildElectronicBillingInvoiceCommandFromSaleEvent,
  isSaleCompletedForElectronicBillingEvent,
} from "../mappers/sale-completed-for-electronic-billing.mapper";
import { ElectronicBillingProviderResolver } from "../providers/electronic-billing-provider-resolver";
import { ElectronicBillingService } from "../services/electronic-billing.service";
import { ElectronicBillingInboxRepository } from "../repositories/electronic-billing-inbox.repository";
import type {
  ElectronicBillingConsumptionResult,
} from "./electronic-billing-consumer.types";
import {
  ElectronicBillingSaleEventTemporaryFailureError,
  ElectronicBillingSaleEventValidationError,
} from "./electronic-billing-consumer.errors";
import { ElectronicDocumentValidationError } from "../services/electronic-billing.service";
import type {
  SaleCompletedForElectronicBillingEventEnvelope,
  SaleLineSnapshot,
  SaleTotalsSnapshot,
} from "../contracts/electronic-billing-integration-events";

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = canonicalize(value[key]);
      return accumulator;
    }, {});
};

const stableStringify = (value: unknown) => JSON.stringify(canonicalize(value));

const parseAmount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ElectronicBillingSaleEventValidationError("Invalid decimal value in sale billing event");
  }

  return parsed;
};

const isElectronicBillingProviderDisabledError = (
  error: unknown,
): error is ElectronicBillingProviderDisabledError =>
  error instanceof ElectronicBillingProviderDisabledError;

@Injectable()
export class SaleCompletedForElectronicBillingConsumerService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(ElectronicBillingInboxRepository)
    private readonly inboxRepository: ElectronicBillingInboxRepository,
    @Inject(ElectronicBillingService)
    private readonly billingService: ElectronicBillingService,
    @Inject(ElectronicBillingProviderResolver)
    private readonly providerResolver: ElectronicBillingProviderResolver,
  ) {}

  async consume(
    envelope: SaleCompletedForElectronicBillingEventEnvelope,
  ): Promise<ElectronicBillingConsumptionResult> {
    this.validateEnvelope(envelope);

    const payloadHash = createHash("sha256")
      .update(stableStringify(envelope.payload) ?? "")
      .digest("hex");
    const externalReference = buildDeterministicSaleExternalReference(
      envelope.tenantId,
      envelope.source.id,
    );

    const existingByEvent = await this.inboxRepository.findByEventId(envelope.eventId);
    if (existingByEvent) {
      return this.buildResultFromInboxRecord(
        envelope.eventId,
        envelope.tenantId,
        envelope.source.id,
        externalReference,
        existingByEvent,
        payloadHash,
      );
    }

    const existingBySource = await this.inboxRepository.findBySource(
      envelope.tenantId,
      envelope.source.type,
      envelope.source.id,
    );
    if (existingBySource) {
      return this.buildResultFromInboxRecord(
        envelope.eventId,
        envelope.tenantId,
        envelope.source.id,
        externalReference,
        existingBySource,
        payloadHash,
      );
    }

    let resolved;
    try {
      resolved = await this.providerResolver.resolve({
        tenantId: envelope.tenantId,
      });
      } catch (error) {
        if (isElectronicBillingProviderDisabledError(error)) {
          return {
          status: "TEMPORARY_FAILURE",
          eventId: envelope.eventId,
          tenantId: envelope.tenantId,
          sourceType: "SALE",
          sourceId: envelope.source.id,
          externalReference,
          electronicDocumentId: null,
          retryable: true,
          message: error.message,
        };
      }

      throw error;
    }

    return this.db.transaction(async (client) => {
      const inserted = await this.inboxRepository.insertReceived(
        {
          id: randomUUID(),
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          schemaVersion: envelope.schemaVersion,
          tenantId: envelope.tenantId,
          correlationId: envelope.correlationId,
          sourceType: envelope.source.type,
          sourceId: envelope.source.id,
          externalReference,
          payloadHash,
          payload: envelope.payload,
          status: "RECEIVED",
          receivedAt: new Date(envelope.occurredAt),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        client,
      );

      if (!inserted) {
        const existing = await this.inboxRepository.findByEventId(envelope.eventId, client);
        if (existing) {
          return this.buildResultFromInboxRecord(
            envelope.eventId,
            envelope.tenantId,
            envelope.source.id,
            externalReference,
            existing,
            payloadHash,
          );
        }

        const existingSource = await this.inboxRepository.findBySource(
          envelope.tenantId,
          envelope.source.type,
          envelope.source.id,
          client,
        );
        if (existingSource) {
          return this.buildResultFromInboxRecord(
            envelope.eventId,
            envelope.tenantId,
            envelope.source.id,
            externalReference,
            existingSource,
            payloadHash,
          );
        }

        throw new ElectronicBillingSaleEventTemporaryFailureError(
          "Inbox conflict detected but existing event record was not found",
        );
      }

      let command;
      try {
        command = buildElectronicBillingInvoiceCommandFromSaleEvent(
          envelope,
          resolved.context,
          randomUUID(),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid sale billing event";
        await this.inboxRepository.markFailed(
          envelope.eventId,
          {
            errorCode: "ELECTRONIC_BILLING_EVENT_INVALID",
            errorMessage: message,
            status: "FAILED",
          },
          client,
        );
        return {
          status: "INVALID_EVENT",
          eventId: envelope.eventId,
          tenantId: envelope.tenantId,
          sourceType: "SALE",
          sourceId: envelope.source.id,
          externalReference,
          electronicDocumentId: null,
          retryable: false,
          message,
        };
      }

      try {
        this.validateSnapshotTotals(envelope.payload.lines, envelope.payload.totals);

        const aggregate = await this.billingService.createInvoiceDocument(
          command,
          client,
          {
            type: "SALE",
            id: envelope.source.id,
          },
        );

        await this.inboxRepository.markProcessed(
          envelope.eventId,
          {
            electronicDocumentId: aggregate.document!.id,
            processedAt: new Date(),
          },
          client,
        );

        return {
          status: aggregate.idempotent ? "ALREADY_PROCESSED" : "ACCEPTED",
          eventId: envelope.eventId,
          tenantId: envelope.tenantId,
          sourceType: "SALE",
          sourceId: envelope.source.id,
          externalReference,
          electronicDocumentId: aggregate.document!.id,
          retryable: false,
          message: aggregate.idempotent ? "Electronic document already existed" : null,
        };
      } catch (error) {
        if (
          error instanceof ElectronicDocumentValidationError ||
          error instanceof ElectronicBillingSaleEventValidationError
        ) {
          const message = error.message;
          await this.inboxRepository.markFailed(
            envelope.eventId,
            {
              errorCode: "ELECTRONIC_DOCUMENT_VALIDATION_ERROR",
              errorMessage: message,
              status: "FAILED",
            },
            client,
          );
          return {
            status: "INVALID_EVENT",
            eventId: envelope.eventId,
            tenantId: envelope.tenantId,
            sourceType: "SALE",
            sourceId: envelope.source.id,
            externalReference,
            electronicDocumentId: null,
            retryable: false,
            message,
          };
        }

        throw error;
      }
    });
  }

  private validateEnvelope(envelope: SaleCompletedForElectronicBillingEventEnvelope) {
    if (!isSaleCompletedForElectronicBillingEvent(envelope)) {
      throw new ElectronicBillingSaleEventValidationError("Invalid sale billing event envelope");
    }

    if (normalizeText(envelope.eventId).length === 0) {
      throw new ElectronicBillingSaleEventValidationError("eventId is required");
    }

    if (normalizeText(envelope.tenantId).length === 0) {
      throw new ElectronicBillingSaleEventValidationError("tenantId is required");
    }

    if (normalizeText(envelope.source.id).length === 0) {
      throw new ElectronicBillingSaleEventValidationError("source.id is required");
    }
  }

  private validateSnapshotTotals(
    lines: SaleLineSnapshot[],
    totals: SaleTotalsSnapshot,
  ) {
    const lineSubtotal = lines.reduce((sum, line) => sum + parseAmount(line.subtotalAmount), 0);
    const lineTax = lines.reduce((sum, line) => sum + parseAmount(line.taxAmount), 0);
    const totalSubtotal = parseAmount(totals.subtotalAmount);
    const totalDiscount = parseAmount(totals.discountAmount);
    const totalTax = parseAmount(totals.taxAmount);
    const totalAmount = parseAmount(totals.totalAmount);
    const expectedTotal = totalSubtotal - totalDiscount + totalTax;

    if (Math.abs(lineSubtotal - totalSubtotal) > 0.0001) {
      throw new ElectronicBillingSaleEventValidationError("Sale subtotal does not match snapshot totals");
    }

    if (Math.abs(lineTax - totalTax) > 0.0001) {
      throw new ElectronicBillingSaleEventValidationError("Sale tax does not match snapshot totals");
    }

    if (Math.abs(expectedTotal - totalAmount) > 0.0001) {
      throw new ElectronicBillingSaleEventValidationError("Sale total does not match snapshot totals");
    }
  }

  private buildResultFromInboxRecord(
    eventId: string,
    tenantId: string,
    sourceId: string,
    externalReference: string,
    record: Awaited<ReturnType<ElectronicBillingInboxRepository["findByEventId"]>>,
    payloadHash: string,
  ): ElectronicBillingConsumptionResult {
    if (!record) {
      return {
        status: "TEMPORARY_FAILURE",
        eventId,
        tenantId,
        sourceType: "SALE",
        sourceId,
        externalReference,
        electronicDocumentId: null,
        retryable: true,
        message: "Electronic billing inbox event was not found",
      };
    }

    if (record.payload_hash !== payloadHash) {
      return {
        status: "INVALID_EVENT",
        eventId,
        tenantId,
        sourceType: "SALE",
        sourceId,
        externalReference,
        electronicDocumentId: record.electronic_document_id,
        retryable: false,
        message: "Event payload changed for the same event identity",
      };
    }

    if (record.status === "PROCESSED") {
      return {
        status: "ALREADY_PROCESSED",
        eventId,
        tenantId,
        sourceType: "SALE",
        sourceId,
        externalReference: record.external_reference,
        electronicDocumentId: record.electronic_document_id,
        retryable: false,
        message: "Sale billing event already consumed",
      };
    }

    if (record.status === "FAILED") {
      return {
        status: "INVALID_EVENT",
        eventId,
        tenantId,
        sourceType: "SALE",
        sourceId,
        externalReference: record.external_reference,
        electronicDocumentId: record.electronic_document_id,
        retryable: false,
        message: record.last_error_message ?? "Sale billing event previously failed",
      };
    }

    return {
      status: "TEMPORARY_FAILURE",
      eventId,
      tenantId,
      sourceType: "SALE",
      sourceId,
      externalReference: record.external_reference,
      electronicDocumentId: record.electronic_document_id,
      retryable: true,
      message: record.last_error_message ?? "Sale billing event is not ready yet",
    };
  }
}
