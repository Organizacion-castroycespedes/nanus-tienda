import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { OperationalSalesService } from "./operational-sales.service";

const readBooleanEnv = (name: string, fallback: boolean) => {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(raw);
};

const readPositiveIntegerEnv = (name: string, fallback: number) => {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Completes sale voids that stayed PENDING_CREDIT_NOTE because the credit
 * note had no fiscal answer (network failure or slow DIAN).
 */
@Injectable()
export class SaleVoidRequestWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SaleVoidRequestWorker.name);
  private readonly enabled = readBooleanEnv("SALE_VOID_REQUEST_WORKER_ENABLED", true);
  private readonly intervalMs = readPositiveIntegerEnv("SALE_VOID_REQUEST_WORKER_INTERVAL_MS", 60_000);
  private readonly batchSize = readPositiveIntegerEnv("SALE_VOID_REQUEST_WORKER_BATCH_SIZE", 10);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopping = false;

  constructor(
    @Inject(OperationalSalesService)
    private readonly service: OperationalSalesService,
  ) {}

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log("Sale void request worker disabled");
      return;
    }
    this.logger.log(`Sale void request worker enabled. intervalMs=${this.intervalMs}`);
    this.schedule(this.intervalMs);
  }

  onModuleDestroy() {
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(delayMs: number) {
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick() {
    if (this.stopping || this.running) {
      return;
    }
    this.running = true;
    try {
      const result = await this.service.processDueVoidRequests(this.batchSize);
      if (result.processed > 0) {
        this.logger.log(`Sale void requests processed=${result.processed}`);
      }
    } catch (error) {
      this.logger.error(
        `Sale void request cycle failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
      if (!this.stopping) {
        this.schedule(this.intervalMs);
      }
    }
  }
}
