import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { DatabaseService } from "../../../common/db/database.service";
import { AuditService } from "../../../common/services/audit.service";
import type { FinanceActor } from "../common/finance.types";
import { FinanceAccessRepository } from "../common/repositories/finance-access.repository";
import { CashRegisterResponseDto } from "./dto/cash-register-response.dto";
import { CreateCashRegisterDto } from "./dto/create-cash-register.dto";
import { ListCashRegistersDto } from "./dto/list-cash-registers.dto";
import { UpdateCashRegisterDto } from "./dto/update-cash-register.dto";
import {
  CashRegistersRepository,
  type CashRegisterRecord,
} from "./cash-registers.repository";

@Injectable()
export class CashRegistersService {
  constructor(
    @Inject(CashRegistersRepository)
    private readonly repository: CashRegistersRepository,
    @Inject(FinanceAccessRepository)
    private readonly accessRepository: FinanceAccessRepository,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  private isSuperAdmin(actor: FinanceActor) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private canManage(actor: FinanceActor) {
    return this.isSuperAdmin(actor) || actor.roles.includes("SUPER_USER");
  }

  private canRead(actor: FinanceActor) {
    return this.canManage(actor) || actor.roles.includes("ADMIN") || actor.roles.includes("USER");
  }

  private resolveTenantId(actor: FinanceActor, tenantId?: string) {
    if (this.isSuperAdmin(actor)) {
      return tenantId?.trim() || actor.tenantId;
    }
    if (tenantId && tenantId.trim() !== actor.tenantId) {
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

  private async resolveAllowedBranchIds(actor: FinanceActor, tenantId: string) {
    if (this.canManage(actor) || actor.roles.includes("ADMIN")) {
      return undefined;
    }

    const branchIds = await this.accessRepository.findAccessibleBranchIds(
      actor.userId,
      tenantId
    );

    if (branchIds.length === 0) {
      throw new ForbiddenException("Usuario sin sucursales asignadas");
    }

    return branchIds;
  }

  private async assertBranchAccess(
    actor: FinanceActor,
    tenantId: string,
    branchId: string
  ) {
    const branch = await this.accessRepository.findBranchById(branchId, tenantId);
    if (!branch) {
      throw new BadRequestException("Sucursal invalida");
    }
    if (branch.estado !== "ACTIVE") {
      throw new BadRequestException("Sucursal inactiva");
    }
    if (this.canManage(actor) || actor.roles.includes("ADMIN")) {
      return;
    }

    const allowed = await this.accessRepository.userHasBranchAccess(
      actor.userId,
      tenantId,
      branchId
    );
    if (!allowed) {
      throw new ForbiddenException("No autorizado para esta sucursal");
    }
  }

  private async assertTerminalScope(
    tenantId: string,
    branchId: string,
    terminalId?: string | null,
    excludeId?: string
  ) {
    if (!terminalId) {
      return;
    }

    const terminal = await this.accessRepository.findTerminalById(
      terminalId,
      tenantId
    );
    if (!terminal) {
      throw new BadRequestException("Terminal invalida");
    }
    if (terminal.branch_id !== branchId) {
      throw new BadRequestException("La terminal no pertenece a la sucursal");
    }
    if (!terminal.is_active) {
      throw new BadRequestException("Terminal inactiva");
    }

    const exists = await this.repository.existsTerminalAssociation(
      tenantId,
      terminalId,
      excludeId
    );
    if (exists) {
      throw new BadRequestException("La terminal ya tiene una caja asignada");
    }
  }

  private async assertUniqueCode(
    tenantId: string,
    branchId: string,
    codigo: string,
    excludeId?: string
  ) {
    const exists = await this.repository.existsCode(
      tenantId,
      branchId,
      codigo,
      excludeId
    );
    if (exists) {
      throw new BadRequestException("Codigo ya registrado en la sucursal");
    }
  }

  private mapResponse(record: CashRegisterRecord) {
    return plainToInstance(
      CashRegisterResponseDto,
      {
        id: record.id,
        tenantId: record.tenant_id,
        branchId: record.branch_id,
        branchNombre: record.branch_nombre,
        terminalId: record.terminal_id,
        terminalNombre: record.terminal_nombre,
        codigo: record.codigo,
        nombre: record.nombre,
        activo: record.activo,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      },
      { excludeExtraneousValues: true }
    );
  }

  async create(payload: CreateCashRegisterDto, actor: FinanceActor) {
    if (!this.canManage(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    const branchId = payload.branchId;
    const codigo = this.normalizeRequired(payload.codigo, "Codigo requerido");
    const nombre = this.normalizeRequired(payload.nombre, "Nombre requerido");

    await this.assertBranchAccess(actor, tenantId, branchId);
    await this.assertUniqueCode(tenantId, branchId, codigo);
    await this.assertTerminalScope(tenantId, branchId, payload.terminalId);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const created = await this.repository.create(client, {
        tenantId,
        branchId,
        terminalId: payload.terminalId ?? null,
        codigo,
        nombre,
        activo: payload.activo ?? true,
      });
      await client.query("COMMIT");

      if (!created) {
        throw new BadRequestException("No se pudo crear la caja");
      }

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "cash_registers",
        entityId: created.id,
        action: "CASH_REGISTER_CREATED",
        after: this.mapResponse(created),
      });

      return this.mapResponse(created);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async list(filters: ListCashRegistersDto, actor: FinanceActor) {
    if (!this.canRead(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const tenantId = this.resolveTenantId(actor, filters.tenantId);
    const branchId = filters.branchId?.trim();

    if (branchId) {
      await this.assertBranchAccess(actor, tenantId, branchId);
    }

    const branchIds = await this.resolveAllowedBranchIds(actor, tenantId);
    const activo =
      filters.activo === undefined ? undefined : filters.activo === "true";
    const records = await this.repository.list({
      tenantId,
      branchId,
      branchIds,
      activo,
    });

    return records.map((record) => this.mapResponse(record));
  }

  async update(
    cashRegisterId: string,
    payload: UpdateCashRegisterDto,
    actor: FinanceActor
  ) {
    if (!this.canManage(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const current = await this.repository.findById(cashRegisterId);
    if (!current) {
      throw new NotFoundException("Caja no encontrada");
    }

    const tenantId = this.resolveTenantId(actor, current.tenant_id);
    if (tenantId !== current.tenant_id) {
      throw new ForbiddenException("No autorizado");
    }

    const nextBranchId = payload.branchId ?? current.branch_id;
    const nextTerminalId =
      payload.terminalId !== undefined ? payload.terminalId : current.terminal_id;
    const nextCodigo =
      payload.codigo !== undefined
        ? this.normalizeRequired(payload.codigo, "Codigo requerido")
        : current.codigo;
    const nextNombre =
      payload.nombre !== undefined
        ? this.normalizeRequired(payload.nombre, "Nombre requerido")
        : current.nombre;

    await this.assertBranchAccess(actor, tenantId, nextBranchId);
    await this.assertUniqueCode(tenantId, nextBranchId, nextCodigo, cashRegisterId);
    await this.assertTerminalScope(
      tenantId,
      nextBranchId,
      nextTerminalId ?? null,
      cashRegisterId
    );

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const updated = await this.repository.update(client, cashRegisterId, {
        branchId: payload.branchId,
        terminalId: payload.terminalId,
        codigo: payload.codigo !== undefined ? nextCodigo : undefined,
        nombre: payload.nombre !== undefined ? nextNombre : undefined,
        activo: payload.activo,
      });
      await client.query("COMMIT");

      if (!updated) {
        throw new NotFoundException("Caja no encontrada");
      }

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "cash_registers",
        entityId: updated.id,
        action: "CASH_REGISTER_UPDATED",
        before: this.mapResponse(current),
        after: this.mapResponse(updated),
      });

      return this.mapResponse(updated);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
