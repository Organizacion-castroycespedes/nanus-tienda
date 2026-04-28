import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import { TerminalsRepository } from "./terminals.repository";
import type { CreateTerminalDto } from "./dto/create-terminal.dto";
import type { UpdateTerminalDto } from "./dto/update-terminal.dto";

type ActorContext = {
  roles: string[];
  tenantId?: string;
  userId?: string;
};

@Injectable()
export class TerminalsService {
  constructor(
    @Inject(TerminalsRepository)
    private readonly repository: TerminalsRepository,
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private isSuperAdmin(actor: ActorContext) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private resolveTenantId(actor: ActorContext, tenantId?: string) {
    if (this.isSuperAdmin(actor)) {
      if (tenantId) {
        return tenantId;
      }
      if (actor.tenantId) {
        return actor.tenantId;
      }
      throw new BadRequestException("Tenant requerido");
    }
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    if (tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }
    return actor.tenantId;
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

  async createTerminal(payload: CreateTerminalDto, actor: ActorContext) {
    const tenantId = this.resolveTenantId(actor);
    const branchId = this.normalizeRequired(payload.branchId, "Sucursal requerida");
    const name = this.normalizeRequired(payload.name, "Nombre requerido");
    const code = this.normalizeRequired(payload.code, "Código requerido");

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const validBranch = await this.repository.validateBranch(
        tenantId,
        branchId,
        client
      );
      if (!validBranch) {
        throw new BadRequestException("Sucursal inválida");
      }

      const created = await this.repository.createTerminal(client, {
        tenantId,
        branchId,
        name,
        code,
        deviceFingerprint: this.normalizeOptional(payload.deviceFingerprint) ?? undefined,
        isActive: payload.isActive ?? true,
      });

      await client.query("COMMIT");
      return created;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listTerminals(branchId: string | undefined, actor: ActorContext) {
    const tenantId = this.resolveTenantId(actor);
    const normalizedBranchId = branchId?.trim();

    if (normalizedBranchId) {
      const validBranch = await this.repository.validateBranch(
        tenantId,
        normalizedBranchId
      );
      if (!validBranch) {
        throw new BadRequestException("Sucursal inválida");
      }
    }

    return this.repository.findByBranch(tenantId, normalizedBranchId);
  }

  async updateTerminal(
    terminalId: string,
    payload: UpdateTerminalDto,
    actor: ActorContext
  ) {
    const tenantId = this.resolveTenantId(actor);
    const current = await this.repository.findById(terminalId, tenantId);
    if (!current) {
      throw new NotFoundException("Terminal no encontrada");
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

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      if (branchId) {
        const validBranch = await this.repository.validateBranch(
          tenantId,
          branchId,
          client
        );
        if (!validBranch) {
          throw new BadRequestException("Sucursal inválida");
        }
      }

      const updated = await this.repository.updateTerminal(client, terminalId, {
        branchId,
        name:
          payload.name !== undefined
            ? this.normalizeRequired(payload.name, "Nombre requerido")
            : undefined,
        code:
          payload.code !== undefined
            ? this.normalizeRequired(payload.code, "Código requerido")
            : undefined,
        deviceFingerprint:
          payload.deviceFingerprint !== undefined
            ? this.normalizeOptional(payload.deviceFingerprint)
            : undefined,
      });

      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStatus(terminalId: string, isActive: boolean, actor: ActorContext) {
    const tenantId = this.resolveTenantId(actor);
    const current = await this.repository.findById(terminalId, tenantId);
    if (!current) {
      throw new NotFoundException("Terminal no encontrada");
    }

    const updated = await this.repository.updateStatus(undefined, terminalId, isActive);
    return updated;
  }
}
