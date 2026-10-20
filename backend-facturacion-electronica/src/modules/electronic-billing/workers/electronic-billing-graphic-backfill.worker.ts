import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ElectronicDocumentAlreadyProcessingError } from "../contracts/electronic-billing-errors";
import { ElectronicDocumentRepository } from "../repositories/electronic-billing.repositories";
import { ElectronicBillingProcessingService } from "../services/electronic-billing-processing.service";

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_ATTEMPTS = 20;
const DEFAULT_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;

export type GraphicBackfillCycleSummary = {
  stored: number;
  unavailable: number;
  errors: number;
};

const readPositiveIntegerEnv = (name: string, fallback: number) => {
  const raw = Number(process.env[name]);
  return Number.isInteger(raw) && raw > 0 ? raw : fallback;
};

const readBooleanEnv = (name: string, fallback: boolean) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
};

/**
 * Fills the stored fiscal graphic representation of documents accepted before
 * the provider started returning it, so reprints do not depend on the provider.
 */
@Injectable()
export class ElectronicBillingGraphicBackfillWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ElectronicBillingGraphicBackfillWorker.name);
  private readonly enabled = readBooleanEnv("ELECTRONIC_BILLING_GRAPHIC_BACKFILL_ENABLED", true);
  private readonly intervalMs = readPositiveIntegerEnv("ELECTRONIC_BILLING_GRAPHIC_BACKFILL_INTERVAL_MS", DEFAULT_INTERVAL_MS);
  private readonly batchSize = readPositiveIntegerEnv("ELECTRONIC_BILLING_GRAPHIC_BACKFILL_BATCH_SIZE", DEFAULT_BATCH_SIZE);
  private readonly maxAttempts = readPositiveIntegerEnv("ELECTRONIC_BILLING_GRAPHIC_BACKFILL_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS);
  private readonly retryDelayMs = readPositiveIntegerEnv("ELECTRONIC_BILLING_GRAPHIC_BACKFILL_RETRY_DELAY_MS", DEFAULT_RETRY_DELAY_MS);

  private timer: NodeJS.Timeout | null = null;
  private active = false;
  private stopping = false;

  constructor(
    @Inject(ElectronicDocumentRepository)
    private readonly documentRepository: ElectronicDocumentRepository,
    @Inject(ElectronicBillingProcessingService)
    private readonly processingService: ElectronicBillingProcessingService,
  ) {}

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log("Electronic billing graphic representation backfill disabled");
      return;
    }
    this.logger.log(
      `Electronic billing graphic representation backfill enabled. intervalMs=${this.intervalMs} batchSize=${this.batchSize}`,
    );
    this.scheduleNext(this.intervalMs);
  }

  onModuleDestroy() {
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<GraphicBackfillCycleSummary> {
    const summary: GraphicBackfillCycleSummary = { stored: 0, unavailable: 0, errors: 0 };
    if (!this.enabled) {
      return summary;
    }

    const candidates = await this.documentRepository.claimAcceptedMissingGraphicRepresentation({
      limit: this.batchSize,
      maxAttempts: this.maxAttempts,
      retryDelayMs: this.retryDelayMs,
    });

    for (const candidate of candidates) {
      try {
        const stored = await this.processingService.backfillGraphicRepresentation(candidate.tenant_id, candidate.id);
        if (stored) {
          summary.stored += 1;
        } else {
          summary.unavailable += 1;
        }
      } catch (error) {
        if (error instanceof ElectronicDocumentAlreadyProcessingError) {
          summary.unavailable += 1;
          continue;
        }
        summary.errors += 1;
        this.logger.warn(
          `Graphic representation backfill failed for document ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return summary;
  }

  private scheduleNext(delayMs: number) {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick() {
    if (this.stopping || this.active) {
      if (!this.stopping) this.scheduleNext(this.intervalMs);
      return;
    }

    this.active = true;
    try {
      const summary = await this.runOnce();
      if (summary.stored || summary.unavailable || summary.errors) {
        this.logger.log(
          `Graphic representation backfill cycle. stored=${summary.stored} unavailable=${summary.unavailable} errors=${summary.errors}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Graphic representation backfill cycle failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.active = false;
      if (!this.stopping) {
        this.scheduleNext(this.intervalMs);
      }
    }
  }
}
