import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import { PosUserSessionsRepository } from "./pos-user-sessions.repository";
import type { CreatePosSessionDto } from "./dto/create-pos-session.dto";

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
    @Inject(DatabaseService) private readonly db: DatabaseService
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
}
