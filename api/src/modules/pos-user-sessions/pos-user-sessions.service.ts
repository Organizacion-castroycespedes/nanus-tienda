import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import { AccessControlService } from "../../common/services/access-control.service";
import { AuditService } from "../../common/services/audit.service";
import { PosUserSessionsRepository } from "./pos-user-sessions.repository";
import type { CreatePosSessionDto } from "./dto/create-pos-session.dto";
import type { ListPosSessionsDto } from "./dto/list-pos-sessions.dto";
import type { ClosePosSessionDto } from "./dto/close-pos-session.dto";

type ActorContext = {
  roles: string[];
  tenantId?: string;
  userId?: string;
  sessionId?: string;
};

@Injectable()
export class PosUserSessionsService {
  constructor(
    @Inject(PosUserSessionsRepository)
    private readonly repository: PosUserSessionsRepository,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AccessControlService)
    private readonly accessControl: AccessControlService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  private isSuperAdmin(actor: ActorContext) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private resolveTenantId(
    actor: ActorContext,
    fallbackTenantId?: string
  ) {
    if (this.isSuperAdmin(actor)) {
      if (actor.tenantId) {
        return actor.tenantId;
      }
      if (fallbackTenantId) {
        return fallbackTenantId;
      }
      throw new BadRequestException("Tenant requerido");
    }
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    if (fallbackTenantId && fallbackTenantId !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }
    return actor.tenantId;
  }

  private resolveUserId(actor: ActorContext) {
    if (!actor.userId) {
      throw new UnauthorizedException("Usuario no autenticado");
    }
    return actor.userId;
  }

  private normalizeRequired(value: string | undefined, message: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(message);
    }
    return normalized;
  }

  private async resolveAuthSessionId(
    actor: ActorContext,
    userId: string,
    tenantId: string,
    client: PoolClient
  ) {
    const authSessionId = actor.sessionId?.trim();
    if (authSessionId) {
      return authSessionId;
    }

    const activeSessionId = await this.repository.findActiveAuthSessionByUser(
      userId,
      tenantId,
      client
    );
    if (!activeSessionId) {
      throw new UnauthorizedException("Sesion de autenticacion invalida");
    }
    return activeSessionId;
  }

  private async assertBranchAccess(
    actor: ActorContext,
    tenantId: string,
    branchId: string
  ) {
    const allowed = await this.accessControl.canAccessBranch(
      { id: actor.userId, tenantId: actor.tenantId, roles: actor.roles },
      tenantId,
      branchId
    );
    if (!allowed) {
      throw new ForbiddenException("Acceso no autorizado a la sucursal");
    }
  }

  async createPosSession(payload: CreatePosSessionDto, actor: ActorContext) {
    const branchId = this.normalizeRequired(payload.branchId, "Sucursal requerida");
    const terminalId = this.normalizeRequired(payload.terminalId, "Terminal requerida");
    const userId = this.resolveUserId(actor);
    const tenantId = this.resolveTenantId(actor);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const authSessionId = await this.resolveAuthSessionId(
        actor,
        userId,
        tenantId,
        client
      );

      const authSession = await this.repository.validateAuthSession(
        authSessionId,
        client
      );
      if (!authSession || !authSession.is_active) {
        throw new UnauthorizedException("Sesion de autenticacion invalida");
      }
      if (authSession.user_id !== userId || authSession.tenant_id !== tenantId) {
        throw new UnauthorizedException("Sesion de autenticacion invalida");
      }

      await this.assertBranchAccess(actor, tenantId, branchId);

      const terminal = await this.repository.validateTerminal(
        tenantId,
        branchId,
        terminalId,
        client
      );
      if (!terminal) {
        throw new ForbiddenException("Acceso no autorizado a la sucursal o terminal");
      }
      if (!terminal.is_active) {
        throw new BadRequestException("Terminal inactiva");
      }

      await this.repository.deactivateUserSessions(client, userId);

      const created = await this.repository.createSession(client, {
        authSessionId,
        userId,
        tenantId,
        branchId,
        terminalId,
      });
      if (!created) {
        throw new InternalServerErrorException("No se pudo crear la sesion POS");
      }

      await client.query("COMMIT");
      return created;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getCurrentSession(actor: ActorContext) {
    const userId = this.resolveUserId(actor);
    const tenantId = this.resolveTenantId(actor);
    const current = await this.repository.findCurrentByUser(userId, tenantId);

    if (!current) {
      return null;
    }

    return {
      posSessionId: current.id,
      branchId: current.branch_id,
      terminalId: current.terminal_id,
      startedAt: current.started_at,
    };
  }

  private parsePage(value: string | undefined, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  private resolveAdminScope(actor: ActorContext, payload: { branchId?: string; terminalId?: string }) {
    const tenantId = this.resolveTenantId(actor);
    const branchId = this.normalizeRequired(payload.branchId, "Sucursal requerida");
    const terminalId = this.normalizeRequired(payload.terminalId, "Terminal requerida");
    return { tenantId, branchId, terminalId };
  }

  private async assertAdminScope(actor: ActorContext, branchId: string, terminalId: string) {
    await this.assertBranchAccess(actor, this.resolveTenantId(actor), branchId);
    const terminal = await this.repository.validateTerminal(
      this.resolveTenantId(actor),
      branchId,
      terminalId,
    );
    if (!terminal) {
      throw new ForbiddenException("Terminal fuera del alcance autorizado");
    }
    if (!terminal.is_active) {
      throw new BadRequestException("Terminal inactiva");
    }
    return terminal;
  }

  async listActiveForTerminal(query: ListPosSessionsDto, actor: ActorContext) {
    const scope = this.resolveAdminScope(actor, query);
    await this.assertAdminScope(actor, scope.branchId, scope.terminalId);
    const limit = this.parsePage(query.limit, 50, 100);
    const offset = this.parsePage(query.offset, 0, 10000);
    const items = await this.repository.listActiveForTerminal(
      scope.tenantId,
      scope.branchId,
      scope.terminalId,
      limit,
      offset,
    );
    return {
      items: items.map((item) => ({
        id: item.id,
        userEmail: item.user_email,
        userDisplayName: item.user_display_name,
        tenantId: item.tenant_id,
        branchId: item.branch_id,
        terminalId: item.terminal_id,
        terminalCode: item.terminal_code,
        terminalName: item.terminal_name,
        branchName: item.branch_name,
        startedAt: item.started_at,
        isActive: item.is_active,
        hasOpenCash: item.has_open_cash,
        hasPendingOperations: item.pending_sales > 0 || item.pending_payments > 0,
        pendingSales: item.pending_sales,
        pendingPayments: item.pending_payments,
        canClose: !item.has_open_cash && item.pending_sales === 0 && item.pending_payments === 0,
      })),
      limit,
      offset,
    };
  }

  async closeOne(sessionId: string, payload: ClosePosSessionDto, actor: ActorContext) {
    const scope = this.resolveAdminScope(actor, payload);
    const reason = this.normalizeRequired(payload.reason, "Motivo administrativo requerido");
    if (reason.length < 5 || reason.length > 500) {
      throw new BadRequestException("El motivo debe tener entre 5 y 500 caracteres");
    }
    await this.assertAdminScope(actor, scope.branchId, scope.terminalId);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const current = await this.repository.findActiveForAdmin(
        scope.tenantId,
        scope.branchId,
        scope.terminalId,
        this.normalizeRequired(sessionId, "Sesion POS requerida"),
        client,
      );
      if (!current) {
        throw new ConflictException("La sesion POS ya no esta activa o cambio de terminal");
      }
      const safety = await this.repository.getSafetyForSession(
        scope.tenantId,
        scope.branchId,
        scope.terminalId,
        current.id,
        client,
      );
      if (safety.has_open_cash || Number(safety.pending_sales) > 0 || Number(safety.pending_payments) > 0) {
        throw new ConflictException("No se puede cerrar: existe caja abierta u operacion pendiente");
      }
      const closed = await this.repository.closeOne(client, scope.tenantId, scope.terminalId, current.id);
      if (!closed) {
        throw new ConflictException("La sesion POS cambio durante el cierre");
      }
      await client.query("COMMIT");
      this.auditService.logEvent({
        tenantId: scope.tenantId,
        userId: actor.userId ?? null,
        module: "pos-user-sessions",
        entity: "pos_user_sessions",
        entityId: closed.id,
        action: "POS_SESSION_ADMIN_CLOSED",
        before: { isActive: true, terminalId: current.terminal_id },
        after: { isActive: false, endedAt: closed.ended_at, reason },
      });
      return { id: closed.id, isActive: closed.is_active, endedAt: closed.ended_at };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
