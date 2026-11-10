import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ControlCenterDatabaseService } from "../control-center-database.service";
import { ControlCenterAlertsService } from "../alerts/alerts.service";
import { BillingService, systemContext } from "./billing.service";

/**
 * Worker de facturación. Apagado por defecto
 * (CONTROL_CENTER_BILLING_WORKER_ENABLED=true para activarlo). Al terminar
 * corre las alertas de cobro si CONTROL_CENTER_ALERTS_ENABLED=true. Varias
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
    @Inject(ControlCenterAlertsService) private readonly alerts: ControlCenterAlertsService,
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
      if (this.alerts.getConfig().alertsEnabled) {
        const alerts = await this.alerts.runAll("WORKER", systemContext(this.db.getConfig().platformTenantId));
        if (alerts.emailsSent > 0 || alerts.emailsFailed > 0 || alerts.noticesPublished > 0) {
          this.logger.log(
            `Alertas: avisos ${alerts.noticesPublished}, correos enviados ${alerts.emailsSent}, fallidos ${alerts.emailsFailed}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Fallo la ejecución de facturación: ${(error as Error)?.message ?? error}`);
    } finally {
      this.running = false;
    }
  }
}
