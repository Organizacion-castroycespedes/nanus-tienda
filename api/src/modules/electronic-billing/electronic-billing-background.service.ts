import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  ElectronicDocumentAlreadyProcessingError,
  ElectronicDocumentNotProcessableError,
} from "./contracts/electronic-billing-errors";
import type { ElectronicDocumentBackgroundSyncRecord } from "./types/electronic-billing-records";
import {
  ElectronicDocumentRepository,
} from "./repositories/electronic-billing.repositories";
import { ElectronicBillingProcessingService } from "./electronic-billing-processing.service";

type BackgroundCycleSummary = {
  processing: number;
  retry: number;
  skipped: number;
  errors: number;
};

const DEFAULT_SCAN_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_RETRY_ATTEMPTS = 5;
const DEFAULT_LEASE_MS = 300_000;
const DEFAULT_MANUAL_REVIEW_DELAY_MS = 86_400_000;

const readPositiveIntegerEnv = (name: string, fallback: number) => {
  const raw = Number(process.env[name]);
  if (Number.isInteger(raw) && raw > 0) {
    return raw;
  }

  return fallback;
};

const readBooleanEnv = (name: string, fallback: boolean) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
};

@Injectable()
export class ElectronicBillingBackgroundService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ElectronicBillingBackgroundService.name);
  private readonly enabled = readBooleanEnv("ELECTRONIC_BILLING_BACKGROUND_ENABLED", true);
  private readonly scanIntervalMs = readPositiveIntegerEnv(
    "ELECTRONIC_BILLING_BACKGROUND_SCAN_INTERVAL_MS",
    DEFAULT_SCAN_INTERVAL_MS,
  );
  private readonly batchSize = readPositiveIntegerEnv(
    "ELECTRONIC_BILLING_BACKGROUND_BATCH_SIZE",
    DEFAULT_BATCH_SIZE,
  );
  private readonly maxRetryAttempts = readPositiveIntegerEnv(
    "ELECTRONIC_BILLING_BACKGROUND_MAX_RETRY_ATTEMPTS",
    DEFAULT_MAX_RETRY_ATTEMPTS,
  );
  private readonly leaseMs = readPositiveIntegerEnv(
    "ELECTRONIC_BILLING_BACKGROUND_LEASE_MS",
    DEFAULT_LEASE_MS,
  );
  private readonly manualReviewDelayMs = readPositiveIntegerEnv(
    "ELECTRONIC_BILLING_BACKGROUND_MANUAL_REVIEW_DELAY_MS",
    DEFAULT_MANUAL_REVIEW_DELAY_MS,
  );

  private timer: NodeJS.Timeout | null = null;
  private active = false;
  private stopping = false;

  constructor(
    private readonly documentRepository: ElectronicDocumentRepository,
    private readonly processingService: ElectronicBillingProcessingService,
  ) {}

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log("Electronic billing background sync disabled");
      return;
    }

    this.logger.log(
      `Electronic billing background sync enabled. scanIntervalMs=${this.scanIntervalMs} batchSize=${this.batchSize} maxRetryAttempts=${this.maxRetryAttempts}`,
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

  async runOnce(): Promise<BackgroundCycleSummary> {
    if (!this.enabled) {
      return {
        processing: 0,
        retry: 0,
        skipped: 0,
        errors: 0,
      };
    }

    const summary: BackgroundCycleSummary = {
      processing: 0,
      retry: 0,
      skipped: 0,
      errors: 0,
    };

    const now = new Date();
    const processingCandidates = await this.documentRepository.claimDueForBackgroundSync(
      {
        statuses: ["PROCESSING"],
        dueBefore: now,
        limit: this.batchSize,
        leaseMs: this.leaseMs,
      },
    );
    summary.processing += await this.processProcessingCandidates(processingCandidates, summary);

    const retryCandidates = await this.documentRepository.claimDueForBackgroundSync(
      {
        statuses: ["TECHNICAL_ERROR"],
        dueBefore: now,
        limit: this.batchSize,
        leaseMs: this.leaseMs,
      },
    );
    summary.retry += await this.processRetryCandidates(retryCandidates, summary);

    return summary;
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

    if (this.active) {
      this.scheduleNext(this.scanIntervalMs);
      return;
    }

    this.active = true;
    try {
      const summary = await this.runOnce();
      this.logger.debug(
        `Electronic billing background cycle complete. processing=${summary.processing} retry=${summary.retry} skipped=${summary.skipped} errors=${summary.errors}`,
      );
    } catch (error) {
      this.logger.error(
        `Electronic billing background cycle failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.active = false;
      if (!this.stopping) {
        this.scheduleNext(this.scanIntervalMs);
      }
    }
  }

  private async processProcessingCandidates(
    candidates: ElectronicDocumentBackgroundSyncRecord[],
    summary: BackgroundCycleSummary,
  ) {
    let processed = 0;

    for (const candidate of candidates) {
      try {
        await this.processingService.refreshDocumentStatus(candidate.tenant_id, candidate.id);
        processed += 1;
      } catch (error) {
        if (error instanceof ElectronicDocumentAlreadyProcessingError || error instanceof ElectronicDocumentNotProcessableError) {
          summary.skipped += 1;
          continue;
        }

        summary.errors += 1;
        this.logger.warn(
          `Background refresh failed for document ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return processed;
  }

  private async processRetryCandidates(
    candidates: ElectronicDocumentBackgroundSyncRecord[],
    summary: BackgroundCycleSummary,
  ) {
    let retried = 0;

    for (const candidate of candidates) {
      if (candidate.latest_attempt >= this.maxRetryAttempts) {
        await this.deferManualRetry(candidate);
        summary.skipped += 1;
        continue;
      }

      try {
        await this.processingService.retryDocument(candidate.tenant_id, candidate.id);
        retried += 1;
      } catch (error) {
        if (error instanceof ElectronicDocumentNotProcessableError) {
          await this.deferManualRetry(candidate);
          summary.skipped += 1;
          continue;
        }

        if (error instanceof ElectronicDocumentAlreadyProcessingError) {
          summary.skipped += 1;
          continue;
        }

        summary.errors += 1;
        this.logger.warn(
          `Background retry failed for document ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return retried;
  }

  private async deferManualRetry(candidate: ElectronicDocumentBackgroundSyncRecord) {
    await this.documentRepository.updateStatus(
      candidate.tenant_id,
      candidate.id,
      {
        status: candidate.status,
        providerStatus: candidate.provider_status,
        providerStatusDetail: candidate.provider_status_detail,
        lastStatusCheckAt: new Date(Date.now() + this.manualReviewDelayMs),
      },
    );
  }
}
