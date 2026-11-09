import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ControlCenterDatabaseService } from "../control-center-database.service";
import { BillingService } from "./billing.service";

/**
 * Worker de facturación. Apagado por defecto
 * (CONTROL_CENTER_BILLING_WORKER_ENABLED=true para activarlo). Varias
 * instancias son seguras: el bloqueo por contrato y el índice único evitan duplicados.
 */
@Injectable()
export class ControlCenterBillingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("ControlCenterBillingWorker");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService,
    @Inject(BillingService) private readonly billing: BillingService,
  ) {}

  onModuleInit() {
    const config = this.billing.getConfig();
    if (!config.workerEnabled || !this.db.isEnabled()) return;
    this.timer = setInterval(() => void this.tick(), config.workerIntervalMs);
    this.timer.unref?.();
    setTimeout(() => void this.tick(), 30_000).unref?.();
    this.logger.log(`Worker activo cada ${config.workerIntervalMs} ms, anticipación ${config.leadDays} días`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.billing.runAll();
      if (result.chargesCreated > 0 || result.errors.length > 0) {
        this.logger.log(`Cargos creados: ${result.chargesCreated}; errores: ${result.errors.length}`);
      }
    } catch (error) {
      this.logger.error(`Fallo la ejecución de facturación: ${(error as Error)?.message ?? error}`);
    } finally {
      this.running = false;
    }
  }
}
