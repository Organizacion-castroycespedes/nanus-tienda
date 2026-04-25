import { Injectable, Inject, Logger } from "@nestjs/common";
import { DatabaseService } from "../db/database.service";

export type AuditEvent = {
  tenantId: string;
  userId?: string | null;
  module: string;
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly disabledModules = new Set<string>();
  private readonly enabled: boolean;

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {
    this.enabled = (process.env.AUDIT_ENABLED ?? "true").toLowerCase() !== "false";
    const disabled = process.env.AUDIT_DISABLED_MODULES ?? "";
    disabled
      .split(",")
      .map((moduleName) => moduleName.trim().toLowerCase())
      .filter((moduleName) => moduleName.length > 0)
      .forEach((moduleName) => this.disabledModules.add(moduleName));
  }

  isModuleEnabled(moduleName: string) {
    if (!this.enabled) {
      return false;
    }
    return !this.disabledModules.has(moduleName.trim().toLowerCase());
  }

  logEvent(event: AuditEvent) {
    if (!this.isModuleEnabled(event.module)) {
      return;
    }
    setImmediate(() => {
      this.persistEvent(event).catch((error) => {
        this.logger.warn(
          `Audit log failed for ${event.module}:${event.action} - ${error?.message ?? "unknown"}`
        );
      });
    });
  }

  private async persistEvent(event: AuditEvent) {
    await this.db.query(
      `
      INSERT INTO auditoria_eventos
        (tenant_id, usuario_id, modulo, entidad, entidad_id, accion, datos_antes, datos_despues, ip_origen, user_agent)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
      `,
      [
        event.tenantId,
        event.userId ?? null,
        event.module,
        event.entity,
        event.entityId,
        event.action,
        event.before ? JSON.stringify(event.before) : null,
        event.after ? JSON.stringify(event.after) : null,
        event.ip ?? null,
        event.userAgent ?? null,
      ]
    );
  }
}
