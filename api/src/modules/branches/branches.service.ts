import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import { AuditService } from "../../common/services/audit.service";
import { BranchesRepository } from "./branches.repository";
import type { CreateBranchDto } from "./dto/create-branch.dto";
import type { UpdateBranchDto } from "./dto/update-branch.dto";
import type { UpdateBranchStatusDto } from "./dto/update-branch-status.dto";

type ActorContext = {
  roles: string[];
  tenantId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class BranchesService {
  constructor(
    @Inject(BranchesRepository) private readonly repository: BranchesRepository,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  private isSuperAdmin(actor: ActorContext) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private resolveTenantId(actor: ActorContext, tenantId?: string) {
    if (this.isSuperAdmin(actor)) {
      if (!tenantId && actor.tenantId) {
        return actor.tenantId;
      }
      if (!tenantId) {
        throw new BadRequestException("Tenant requerido");
      }
      return tenantId;
    }
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    return actor.tenantId;
  }

  async listBranches(tenantId: string | undefined, actor: ActorContext) {
    if (this.isSuperAdmin(actor)) {
      return this.repository.list(tenantId);
    }
    return this.repository.list(this.resolveTenantId(actor));
  }

  async getBranch(branchId: string, actor: ActorContext) {
    const tenantId = this.isSuperAdmin(actor)
      ? undefined
      : this.resolveTenantId(actor);
    const branch = await this.repository.findById(branchId, tenantId);
    if (!branch) {
      throw new NotFoundException("Sucursal no encontrada");
    }
    return branch;
  }

  async createBranch(payload: CreateBranchDto, actor: ActorContext) {
    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const hasPrincipal = await this.repository.hasPrincipal(tenantId, client);
      let esPrincipal = payload.esPrincipal ?? false;
      if (!hasPrincipal) {
        esPrincipal = true;
      }
      if (esPrincipal && hasPrincipal) {
        await this.repository.clearPrincipal(tenantId, client);
      }
      const created = await this.repository.insert(
        tenantId,
        payload,
        esPrincipal,
        client
      );
      await client.query("COMMIT");
      if (created) {
        this.recordAuditEvent(
          "BRANCH_CREATED",
          created.id,
          null,
          created,
          actor,
          tenantId
        );
      }
      return created;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBranch(branchId: string, payload: UpdateBranchDto, actor: ActorContext) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const tenantId = this.isSuperAdmin(actor)
        ? undefined
        : this.resolveTenantId(actor);
      const current = await this.repository.findById(branchId, tenantId);
      if (!current) {
        throw new NotFoundException("Sucursal no encontrada");
      }

      let esPrincipal: boolean | null | undefined = undefined;
      if (payload.esPrincipal === true) {
        await this.repository.clearPrincipal(current.tenant_id, client);
        esPrincipal = true;
      } else if (payload.esPrincipal === false) {
        if (current.es_principal) {
          const hasOther = await this.repository.hasOtherPrincipal(
            current.tenant_id,
            current.id,
            client
          );
          if (!hasOther) {
            throw new BadRequestException(
              "Debe existir una sucursal principal por tenant"
            );
          }
        }
        esPrincipal = false;
      }

      const updated = await this.repository.update(
        branchId,
        payload,
        esPrincipal,
        client
      );
      await client.query("COMMIT");
      if (updated) {
        this.recordAuditEvent(
          "BRANCH_UPDATED",
          updated.id,
          current,
          updated,
          actor,
          updated.tenant_id
        );
      }
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStatus(
    branchId: string,
    payload: UpdateBranchStatusDto,
    actor: ActorContext
  ) {
    const tenantId = this.isSuperAdmin(actor)
      ? undefined
      : this.resolveTenantId(actor);
    const current = await this.repository.findById(branchId, tenantId);
    if (!current) {
      throw new NotFoundException("Sucursal no encontrada");
    }
    const updated = await this.repository.updateStatus(branchId, payload.estado);
    if (updated) {
      this.recordAuditEvent(
        "BRANCH_STATUS_UPDATED",
        updated.id,
        current,
        updated,
        actor,
        updated.tenant_id
      );
    }
    return updated;
  }

  private recordAuditEvent(
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
    actor: ActorContext,
    tenantId: string
  ) {
    this.auditService.logEvent({
      tenantId,
      userId: actor.userId ?? null,
      module: "branches",
      entity: "tenant_branches",
      entityId,
      action,
      before,
      after,
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  }
}
