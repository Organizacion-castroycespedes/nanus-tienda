import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  DEFAULT_INTEGRATION_OUTBOX_INLINE_TIMEOUT_MS,
  type IntegrationOutboxConfig,
} from "../config/integration-outbox.config";
import type { ElectronicBillingInlineDelivery } from "../contracts/electronic-billing-outcome";
import type { SaleCompletedForElectronicBillingEventEnvelope } from "../contracts/integration-outbox-events";
import type { IntegrationOutboxEventRecord } from "../repositories/integration-outbox.repository";
import { BillingIntegrationClient, type BillingSendOptions } from "./billing-integration-client";
import { IntegrationOutboxService } from "./integration-outbox.service";
import { INTEGRATION_OUTBOX_CONFIG } from "../integration-outbox.tokens";

export type IntegrationOutboxDispatcherSummary = {
  published: number;
  retryable: number;
  failed: number;
  skipped: number;
  errors: number;
};

export type IntegrationOutboxSingleEventResult = IntegrationOutboxDispatcherSummary & {
  delivery: ElectronicBillingInlineDelivery;
};

const SKIPPED_DELIVERY: ElectronicBillingInlineDelivery = {
  outcome: "SKIPPED",
  statusCode: null,
  errorCode: null,
  message: null,
  electronicDocument: null,
};

const failedDelivery = (
  errorCode: string,
  message: string | null,
  statusCode: number | null = null,
  electronicDocument: ElectronicBillingInlineDelivery["electronicDocument"] = null,
): ElectronicBillingInlineDelivery => ({
  outcome: "FAILED",
  statusCode,
  errorCode,
  message,
  electronicDocument,
});

const retryableDelivery = (
  message: string | null,
  statusCode: number | null = null,
  electronicDocument: ElectronicBillingInlineDelivery["electronicDocument"] = null,
): ElectronicBillingInlineDelivery => ({
  outcome: "RETRYABLE",
  statusCode,
  errorCode: "BILLING_BACKEND_UNREACHABLE",
  message,
  electronicDocument,
});

const isPositiveInteger = (value: number) => Number.isInteger(value) && value > 0;

@Injectable()
export class IntegrationOutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationOutboxDispatcher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopping = false;

  constructor(
    @Inject(INTEGRATION_OUTBOX_CONFIG)
    private readonly config: IntegrationOutboxConfig,
    @Inject(IntegrationOutboxService)
    private readonly outboxService: IntegrationOutboxService,
    @Inject(BillingIntegrationClient)
    private readonly billingClient: BillingIntegrationClient,
  ) {}

  async onModuleInit() {
    if (!this.canRun()) {
      this.logger.log("Integration outbox dispatcher disabled");
      return;
    }

    this.logger.log(
      `Integration outbox dispatcher enabled. scanIntervalMs=${this.config.scanIntervalMs} batchSize=${this.config.batchSize} concurrencyLimit=${this.config.concurrencyLimit} maxRetryAttempts=${this.config.maxRetryAttempts}`,
    );
    this.scheduleNext(0);
  }

  onModuleDestroy() {
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<IntegrationOutboxDispatcherSummary> {
    if (!this.canRun()) {
      return {
        published: 0,
        retryable: 0,
        failed: 0,
        skipped: 0,
        errors: 0,
      };
    }

    const claimed = await this.outboxService.claimDueEvents(
      this.config.batchSize,
      this.config.leaseMs,
    );
    return this.processClaimedEvents(claimed);
  }

  /**
   * Online emission right after the sale commit. The event row already exists
   * (same transaction as the sale), so a crash here leaves it PENDING for the
   * background dispatcher instead of losing the fiscal request.
   */
  async runOnceForEvent(eventId: string): Promise<IntegrationOutboxSingleEventResult> {
    const skipped: IntegrationOutboxSingleEventResult = {
      published: 0,
      retryable: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      delivery: SKIPPED_DELIVERY,
    };
    if (!this.config.billingBackendBaseUrl || !this.config.internalToken) {
      return skipped;
    }

    const claimed = await this.outboxService.claimDueEvent(eventId, this.config.leaseMs);
    if (!claimed) {
      return skipped;
    }

    const summary: IntegrationOutboxDispatcherSummary = {
      published: 0,
      retryable: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
    };
    const delivery = await this.processSingleEvent(claimed, summary, {
      timeoutMs: this.config.inlineTimeoutMs ?? DEFAULT_INTEGRATION_OUTBOX_INLINE_TIMEOUT_MS,
    });
    return { ...summary, delivery };
  }

  private canRun() {
    return Boolean(
      this.config.enabled &&
        this.config.billingBackendBaseUrl &&
        this.config.internalToken &&
        isPositiveInteger(this.config.batchSize) &&
        isPositiveInteger(this.config.concurrencyLimit),
    );
  }

  private scheduleNext(delayMs: number) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick() {
    if (this.stopping) {
      return;
    }

    if (this.running) {
      this.scheduleNext(this.config.scanIntervalMs);
      return;
    }

    this.running = true;
    try {
      const summary = await this.runOnce();
      this.logger.debug(
        `Integration outbox cycle complete. published=${summary.published} retryable=${summary.retryable} failed=${summary.failed} skipped=${summary.skipped} errors=${summary.errors}`,
      );
    } catch (error) {
      this.logger.error(
        `Integration outbox cycle failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
      if (!this.stopping) {
        this.scheduleNext(this.config.scanIntervalMs);
      }
    }
  }

  private async processClaimedEvents(
    claimed: IntegrationOutboxEventRecord[],
  ): Promise<IntegrationOutboxDispatcherSummary> {
    const summary: IntegrationOutboxDispatcherSummary = {
      published: 0,
      retryable: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
    };

    if (claimed.length === 0) {
      return summary;
    }

    const queue = [...claimed];
    const workers = Array.from(
      { length: Math.min(this.config.concurrencyLimit, queue.length) },
      async () => {
        while (queue.length > 0) {
          const event = queue.shift();
          if (!event) {
            return;
          }

          await this.processSingleEvent(event, summary);
        }
      },
    );

    await Promise.all(workers);
    return summary;
  }

  private async processSingleEvent(
    event: IntegrationOutboxEventRecord,
    summary: IntegrationOutboxDispatcherSummary,
    sendOptions: BillingSendOptions = {},
  ): Promise<ElectronicBillingInlineDelivery> {
    try {
      const payload = event.payload as {
        sale?: { saleStatus?: string | null };
        customer?: {
          isFinalConsumer?: boolean;
          identificationNumber?: string | null;
          identificationTypeCode?: string | null;
          customerType?: string | null;
          firstName?: string | null;
          familyName?: string | null;
          legalName?: string | null;
          countryCode?: string | null;
          countryName?: string | null;
          departmentCode?: string | null;
          departmentName?: string | null;
          municipalityCode?: string | null;
          cityName?: string | null;
          addressLine1?: string | null;
          email?: string | null;
          taxLevelCode?: string | null;
          taxSchemeId?: string | null;
          fiscalResponsibilityCodes?: string[] | null;
        };
        lines?: Array<{ taxAmount?: string | number | null; taxes?: unknown[] }>;
      };
      const hasTaxLines = Boolean(
        payload.lines?.some(
          (line) => Number(line.taxAmount ?? 0) > 0 || Boolean(line.taxes?.length),
        ),
      );
      const customer = payload.customer;
      const requiresPersonNames =
        customer?.customerType === "PERSON" && customer.isFinalConsumer !== true;
      const customerFiscalDataComplete = Boolean(
        customer?.identificationNumber?.trim() &&
          customer?.identificationTypeCode?.trim() &&
          customer.legalName?.trim() &&
          customer.countryCode?.trim() &&
          customer.countryName?.trim() &&
          customer.departmentCode?.trim() &&
          customer.departmentName?.trim() &&
          customer.municipalityCode?.trim() &&
          customer.cityName?.trim() &&
          customer.addressLine1?.trim() &&
          customer.email?.trim() &&
          customer.taxLevelCode?.trim() &&
          customer.taxSchemeId?.trim() &&
          customer.fiscalResponsibilityCodes?.length &&
          (requiresPersonNames ? customer.firstName?.trim() : true) &&
          (requiresPersonNames ? customer.familyName?.trim() : true),
      );
      if (
        event.event_type === "SALE_COMPLETED_FOR_ELECTRONIC_BILLING" &&
        ((payload.sale?.saleStatus !== undefined &&
          payload.sale?.saleStatus !== "CONFIRMED") ||
          (hasTaxLines &&
            !customerFiscalDataComplete))
      ) {
        const ineligibleReason =
          payload.sale?.saleStatus !== undefined &&
          payload.sale?.saleStatus !== "CONFIRMED"
            ? "sale snapshot is not CONFIRMED"
            : "customer fiscal data is incomplete for tax-bearing sale";
        await this.outboxService.markTerminalFailure(event.event_id, {
          lastError: JSON.stringify({
            code: "OUTBOX_EVENT_INELIGIBLE_SNAPSHOT",
            reason: ineligibleReason,
          }),
        });
        summary.failed += 1;
        return failedDelivery(
          "OUTBOX_EVENT_INELIGIBLE_SNAPSHOT",
          ineligibleReason === "sale snapshot is not CONFIRMED"
            ? "La venta no está confirmada para facturación electrónica."
            : "Los datos fiscales del cliente están incompletos para una factura con IVA.",
        );
      }
      const envelope: SaleCompletedForElectronicBillingEventEnvelope = {
        eventId: event.event_id,
        eventType: event.event_type as SaleCompletedForElectronicBillingEventEnvelope["eventType"],
        schemaVersion: event.schema_version as 1,
        tenantId: event.tenant_id,
        correlationId: event.correlation_id,
        occurredAt:
          event.created_at instanceof Date ? event.created_at.toISOString() : event.created_at,
        source: {
          type: "SALE",
          id: event.source_id,
        },
        payload: event.payload as SaleCompletedForElectronicBillingEventEnvelope["payload"],
      };

      const result = await this.billingClient.sendSaleCompletedEvent(envelope, sendOptions);
      const electronicDocument = result.electronicDocument ?? null;

      if (result.outcome === "PUBLISHED" || result.outcome === "ALREADY_PROCESSED") {
        await this.outboxService.markPublished(event.event_id, new Date());
        summary.published += 1;
        return {
          outcome: "PUBLISHED",
          statusCode: result.statusCode,
          errorCode: null,
          message: result.message,
          electronicDocument,
        };
      }

      if (result.retryable) {
        const retryAfterMs = result.retryAfterMs ?? this.computeBackoffMs(event.attempt_count);
        const nextAttemptAt = new Date(Date.now() + retryAfterMs);
        if (event.attempt_count >= this.config.maxRetryAttempts) {
          await this.outboxService.markTerminalFailure(event.event_id, {
            lastError: result.message ?? "Integration outbox max retry attempts reached",
          });
          summary.failed += 1;
          return failedDelivery("OUTBOX_MAX_RETRY_ATTEMPTS", result.message, result.statusCode, electronicDocument);
        }

        await this.outboxService.markRetryableFailure(
          event.event_id,
          {
            nextAttemptAt,
            lastError: result.message ?? "Integration outbox temporary failure",
          },
        );
        summary.retryable += 1;
        return retryableDelivery(result.message, result.statusCode, electronicDocument);
      }

      await this.outboxService.markTerminalFailure(event.event_id, {
        lastError: result.message ?? "Integration outbox non-retryable failure",
      });
      summary.failed += 1;
      return failedDelivery("BILLING_REQUEST_REJECTED", result.message, result.statusCode, electronicDocument);
    } catch (error) {
      summary.errors += 1;
      const lastError = error instanceof Error ? error.message : String(error);
      if (event.attempt_count >= this.config.maxRetryAttempts) {
        await this.outboxService.markTerminalFailure(event.event_id, {
          lastError,
        });
        summary.failed += 1;
        return failedDelivery("OUTBOX_MAX_RETRY_ATTEMPTS", lastError);
      }

      await this.outboxService.markRetryableFailure(
        event.event_id,
        {
          nextAttemptAt: new Date(Date.now() + this.computeBackoffMs(event.attempt_count)),
          lastError,
        },
      );
      summary.retryable += 1;
      return retryableDelivery(lastError);
    }
  }

  private computeBackoffMs(attemptCount: number) {
    const exponent = Math.max(0, attemptCount - 1);
    const backoff = this.config.initialBackoffMs * Math.pow(2, exponent);
    return Math.min(backoff, this.config.maxBackoffMs);
  }
}
