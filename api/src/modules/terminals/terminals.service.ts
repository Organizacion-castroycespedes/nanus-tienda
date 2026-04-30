import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import { AuditService } from "../../common/services/audit.service";
import {
  TerminalsRepository,
  type TerminalRecord,
} from "./terminals.repository";
import type { CreateTerminalDto } from "./dto/create-terminal.dto";
import type { UpdateTerminalDto } from "./dto/update-terminal.dto";

type ActorContext = {
  roles: string[];
  tenantId?: string;
  userId?: string;
};

type ListTerminalFilters = {
  tenantId?: string;
  branchId?: string;
};

@Injectable()
export class TerminalsService {
  constructor(
    @Inject(TerminalsRepository)
    private readonly repository: TerminalsRepository,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  private canManageTerminals(actor: ActorContext) {
    return (
      actor.roles.includes("SUPER_ADMIN") ||
      actor.roles.includes("SUPER_USER")
    );
  }

  private resolveTenantId(actor: ActorContext, tenantId?: string) {
    if (this.canManageTerminals(actor)) {
      if (tenantId) {
        return tenantId;
      }
      if (actor.tenantId) {
        return actor.tenantId;
      }
      throw new BadRequestException("Tenant requerido");
    }

    throw new ForbiddenException("No autorizado");
  }

  private normalizeRequired(value: string | undefined, message: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(message);
    }
    return normalized;
  }

  private normalizeOptional(value: string | null | undefined) {
    if (value === null) {
      return null;
    }
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private mapAuditTerminal(record: TerminalRecord) {
    return {
      id: record.id,
      tenantId: record.tenant_id,
      branchId: record.branch_id,
      name: record.name,
      code: record.code,
      deviceFingerprint: record.device_fingerprint,
      isActive: record.is_active,
    };
  }

  private async assertBranchBelongsToTenant(
    tenantId: string,
    branchId: string,
    client?: PoolClient
  ) {
    const validBranch = await this.repository.validateBranch(
      tenantId,
      branchId,
      client
    );
    if (!validBranch) {
      throw new BadRequestException("Sucursal invalida");
    }
  }

  private async assertCodeUniqueInBranch(
    tenantId: string,
    branchId: string,
    code: string,
    excludeId?: string,
    client?: PoolClient
  ) {
    const exists = await this.repository.existsCodeInBranch(
      tenantId,
      branchId,
      code,
      excludeId,
      client
    );
    if (exists) {
      throw new BadRequestException("Codigo ya existe en la sucursal");
    }
  }

  async createTerminal(payload: CreateTerminalDto, actor: ActorContext) {
    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    const branchId = this.normalizeRequired(payload.branchId, "Sucursal requerida");
    const name = this.normalizeRequired(payload.name, "Nombre requerido");
    const code = this.normalizeRequired(payload.code, "Codigo requerido");

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      await this.assertBranchBelongsToTenant(tenantId, branchId, client);
      await this.assertCodeUniqueInBranch(tenantId, branchId, code, undefined, client);

      const created = await this.repository.createTerminal(client, {
        tenantId,
        branchId,
        name,
        code,
        deviceFingerprint:
          this.normalizeOptional(payload.deviceFingerprint) ?? undefined,
        isActive: payload.isActive ?? true,
      });

      await client.query("COMMIT");

      if (created) {
        this.auditService.logEvent({
          tenantId,
          userId: actor.userId ?? null,
          module: "terminals",
          entity: "terminals",
          entityId: created.id,
          action: "TERMINAL_CREATED",
          after: this.mapAuditTerminal(created),
        });
      }

      return created;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listTerminals(filters: ListTerminalFilters, actor: ActorContext) {
    const tenantId = this.resolveTenantId(actor, filters.tenantId);
    const normalizedBranchId = filters.branchId?.trim();

    if (normalizedBranchId) {
      await this.assertBranchBelongsToTenant(tenantId, normalizedBranchId);
    }

    return this.repository.findByBranch(tenantId, normalizedBranchId);
  }

  async updateTerminal(
    terminalId: string,
    payload: UpdateTerminalDto,
    actor: ActorContext
  ) {
    const current = await this.repository.findById(terminalId);
    if (!current) {
      throw new NotFoundException("Terminal no encontrada");
    }

    const tenantId = this.resolveTenantId(actor, current.tenant_id);
    if (current.tenant_id !== tenantId) {
      throw new ForbiddenException("No autorizado para este tenant");
    }

    const branchId =
      payload.branchId !== undefined
        ? this.normalizeRequired(payload.branchId, "Sucursal requerida")
        : undefined;

    if (
      branchId === undefined &&
      payload.name === undefined &&
      payload.code === undefined &&
      payload.deviceFingerprint === undefined
    ) {
      throw new BadRequestException("Sin cambios para actualizar");
    }

    const nextBranchId = branchId ?? current.branch_id;
    const nextCode =
      payload.code !== undefined
        ? this.normalizeRequired(payload.code, "Codigo requerido")
        : current.code;

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      if (branchId) {
        await this.assertBranchBelongsToTenant(tenantId, branchId, client);
      }

      await this.assertCodeUniqueInBranch(
        tenantId,
        nextBranchId,
        nextCode,
        terminalId,
        client
      );

      const updated = await this.repository.updateTerminal(client, terminalId, {
        branchId,
        name:
          payload.name !== undefined
            ? this.normalizeRequired(payload.name, "Nombre requerido")
            : undefined,
        code: payload.code !== undefined ? nextCode : undefined,
        deviceFingerprint:
          payload.deviceFingerprint !== undefined
            ? this.normalizeOptional(payload.deviceFingerprint)
            : undefined,
      });

      await client.query("COMMIT");

      if (updated) {
        this.auditService.logEvent({
          tenantId,
          userId: actor.userId ?? null,
          module: "terminals",
          entity: "terminals",
          entityId: updated.id,
          action: "TERMINAL_UPDATED",
          before: this.mapAuditTerminal(current),
          after: this.mapAuditTerminal(updated),
        });
      }

      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStatus(terminalId: string, isActive: boolean, actor: ActorContext) {
    const current = await this.repository.findById(terminalId);
    if (!current) {
      throw new NotFoundException("Terminal no encontrada");
    }

    const tenantId = this.resolveTenantId(actor, current.tenant_id);
    if (current.tenant_id !== tenantId) {
      throw new ForbiddenException("No autorizado para este tenant");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const updated = await this.repository.updateStatus(client, terminalId, isActive);

      await client.query("COMMIT");

      if (updated) {
        this.auditService.logEvent({
          tenantId,
          userId: actor.userId ?? null,
          module: "terminals",
          entity: "terminals",
          entityId: updated.id,
          action: "TERMINAL_STATUS_CHANGED",
          before: this.mapAuditTerminal(current),
          after: this.mapAuditTerminal(updated),
        });
      }

      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
