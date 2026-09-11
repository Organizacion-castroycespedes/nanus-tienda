import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { IntegrationOutboxConfig } from "../config/integration-outbox.config";
import type { SaleCompletedForElectronicBillingEventEnvelope } from "../contracts/integration-outbox-events";
import type { IntegrationOutboxEventRecord } from "../repositories/integration-outbox.repository";
import { BillingIntegrationClient } from "./billing-integration-client";
import { IntegrationOutboxService } from "./integration-outbox.service";
import { INTEGRATION_OUTBOX_CONFIG } from "../integration-outbox.tokens";

export type IntegrationOutboxDispatcherSummary = {
  published: number;
  retryable: number;
  failed: number;
  skipped: number;
  errors: number;
};

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
  ) {
    try {
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

      const result = await this.billingClient.sendSaleCompletedEvent(envelope);

      if (result.outcome === "PUBLISHED" || result.outcome === "ALREADY_PROCESSED") {
        await this.outboxService.markPublished(event.event_id, new Date());
        summary.published += 1;
        return;
      }

      if (result.retryable) {
        const retryAfterMs = result.retryAfterMs ?? this.computeBackoffMs(event.attempt_count);
        const nextAttemptAt = new Date(Date.now() + retryAfterMs);
        if (event.attempt_count >= this.config.maxRetryAttempts) {
          await this.outboxService.markTerminalFailure(event.event_id, {
            lastError: result.message ?? "Integration outbox max retry attempts reached",
          });
          summary.failed += 1;
          return;
        }

        await this.outboxService.markRetryableFailure(
          event.event_id,
          {
            nextAttemptAt,
            lastError: result.message ?? "Integration outbox temporary failure",
          },
        );
        summary.retryable += 1;
        return;
      }

      await this.outboxService.markTerminalFailure(event.event_id, {
        lastError: result.message ?? "Integration outbox non-retryable failure",
      });
      summary.failed += 1;
    } catch (error) {
      summary.errors += 1;
      const lastError = error instanceof Error ? error.message : String(error);
      if (event.attempt_count >= this.config.maxRetryAttempts) {
        await this.outboxService.markTerminalFailure(event.event_id, {
          lastError,
        });
        summary.failed += 1;
        return;
      }

      await this.outboxService.markRetryableFailure(
        event.event_id,
        {
          nextAttemptAt: new Date(Date.now() + this.computeBackoffMs(event.attempt_count)),
          lastError,
        },
      );
      summary.retryable += 1;
    }
  }

  private computeBackoffMs(attemptCount: number) {
    const exponent = Math.max(0, attemptCount - 1);
    const backoff = this.config.initialBackoffMs * Math.pow(2, exponent);
    return Math.min(backoff, this.config.maxBackoffMs);
  }
}
