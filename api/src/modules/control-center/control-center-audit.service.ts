import { BadRequestException, Injectable } from "@nestjs/common";
import type { ControlCenterQueryable } from "./control-center-database.service";
import {
  CONTROL_CENTER_CRITICAL_ACTIONS,
  CONTROL_CENTER_MIN_REASON_LENGTH,
  CONTROL_CENTER_REASON_REQUIRED_CODE,
} from "./control-center.constants";

export type ControlCenterAuditEvent = {
  actorUserId: string;
  actorTenantId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type ControlCenterRequestContext = Pick<
  ControlCenterAuditEvent,
  "actorUserId" | "actorTenantId" | "requestId" | "ip" | "userAgent"
>;

const firstHeader = (value: unknown) =>
  Array.isArray(value) ? String(value[0] ?? "") : typeof value === "string" ? value : "";

const truncate = (value: string, max: number) => (value.length > max ? value.slice(0, max) : value);

export const buildControlCenterRequestContext = (request: {
  user?: { id?: string; tenantId?: string };
  headers?: Record<string, unknown>;
  ip?: string;
}): ControlCenterRequestContext => {
  const headers = request.headers ?? {};
  const requestId = firstHeader(headers["x-request-id"]).trim();
  const userAgent = firstHeader(headers["user-agent"]).trim();
  return {
    actorUserId: request.user?.id ?? "",
    actorTenantId: request.user?.tenantId ?? "",
    requestId: requestId ? truncate(requestId, 120) : null,
    ip: request.ip ? truncate(request.ip, 64) : null,
    userAgent: userAgent ? truncate(userAgent, 512) : null,
  };
};

export const assertControlCenterReason = (
  action: string,
  reason: string | null | undefined,
  criticalActions: ReadonlySet<string> = CONTROL_CENTER_CRITICAL_ACTIONS,
) => {
  if (!criticalActions.has(action)) return;
  if (typeof reason !== "string" || reason.trim().length < CONTROL_CENTER_MIN_REASON_LENGTH) {
    throw new BadRequestException({
      code: CONTROL_CENTER_REASON_REQUIRED_CODE,
      message: `La acción requiere un motivo de al menos ${CONTROL_CENTER_MIN_REASON_LENGTH} caracteres`,
    });
  }
};

const toJson = (value: unknown) => (value === undefined || value === null ? null : JSON.stringify(value));

/**
 * Registra eventos administrativos dentro de la transaccion de la operacion
 * de negocio: ambos confirman o fallan juntos.
 */
@Injectable()
export class ControlCenterAuditService {
  constructor(
    private readonly criticalActions: ReadonlySet<string> = CONTROL_CENTER_CRITICAL_ACTIONS,
  ) {}

  async record(tx: ControlCenterQueryable, event: ControlCenterAuditEvent): Promise<string> {
    const action = event.action?.trim();
    const entityType = event.entityType?.trim();
    if (!action || !entityType || !event.actorUserId || !event.actorTenantId) {
      throw new BadRequestException("Evento de auditoría incompleto");
    }
    assertControlCenterReason(action, event.reason, this.criticalActions);

    const reason = event.reason?.trim() ? event.reason.trim() : null;
    const result = await tx.query(
      `
      INSERT INTO control_center.admin_audit_events (
        actor_user_id, actor_tenant_id, action, entity_type, entity_id,
        before, after, reason, request_id, ip, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11)
      RETURNING id
      `,
      [
        event.actorUserId,
        event.actorTenantId,
        action,
        entityType,
        event.entityId ?? null,
        toJson(event.before),
        toJson(event.after),
        reason,
        event.requestId ?? null,
        event.ip ?? null,
        event.userAgent ?? null,
      ],
    );
    return String(result.rows[0].id);
  }
}
