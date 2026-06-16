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
import { CashMovementsRepository } from "../cash-movements/cash-movements.repository";
import { CashRegistersRepository } from "../cash-registers/cash-registers.repository";
import { CashSessionResponseDto } from "./dto/cash-session-response.dto";
import type { CashSessionSummaryResponseDto } from "./dto/cash-session-summary-response.dto";
import { CloseCashSessionDto } from "./dto/close-cash-session.dto";
import { CurrentCashSessionQueryDto } from "./dto/current-cash-session-query.dto";
import { ListCashSessionHistoryDto } from "./dto/list-cash-session-history.dto";
import { OpenCashSessionDto } from "./dto/open-cash-session.dto";
import {
  CashSessionsRepository,
  type CashSessionRecord,
} from "./cash-sessions.repository";

@Injectable()
export class CashSessionsService {
  constructor(
    @Inject(CashSessionsRepository)
    private readonly repository: CashSessionsRepository,
    @Inject(CashRegistersRepository)
    private readonly cashRegistersRepository: CashRegistersRepository,
    @Inject(CashMovementsRepository)
    private readonly cashMovementsRepository: CashMovementsRepository,
    @Inject(FinanceAccessRepository)
    private readonly accessRepository: FinanceAccessRepository,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  private isSuperAdmin(actor: FinanceActor) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private canManageTenant(actor: FinanceActor) {
    return this.isSuperAdmin(actor) || actor.roles.includes("SUPER_USER");
  }

  private canAdminCash(actor: FinanceActor) {
    return this.canManageTenant(actor) || actor.roles.includes("ADMIN");
  }

  private canOpenCash(actor: FinanceActor) {
    return this.canAdminCash(actor) || actor.roles.includes("USER");
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

  private async assertActiveUser(actor: FinanceActor, tenantId: string) {
    const user = await this.accessRepository.findUserById(actor.userId, tenantId);
    if (!user || user.estado !== "ACTIVE") {
      throw new ForbiddenException("Usuario no autorizado");
    }
  }

  private async assertBranchScope(
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
    if (this.canManageTenant(actor)) {
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

  private async resolveAllowedBranchIds(actor: FinanceActor, tenantId: string) {
    if (this.canManageTenant(actor)) {
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

  private mapResponse(record: CashSessionRecord) {
    return plainToInstance(
      CashSessionResponseDto,
      {
        id: record.id,
        tenantId: record.tenant_id,
        branchId: record.branch_id,
        cashRegisterId: record.cash_register_id,
        cashRegisterCodigo: record.cash_register_codigo,
        cashRegisterNombre: record.cash_register_nombre,
        openedByUserId: record.opened_by_user_id,
        openedByUserEmail: record.opened_by_user_email,
        closedByUserId: record.closed_by_user_id,
        closedByUserEmail: record.closed_by_user_email,
        openedAt: record.opened_at,
        closedAt: record.closed_at,
        openingAmount: Number(record.opening_amount),
        closingAmount:
          record.closing_amount === null ? null : Number(record.closing_amount),
        expectedAmount:
          record.expected_amount === null ? null : Number(record.expected_amount),
        differenceAmount:
          record.difference_amount === null
            ? null
            : Number(record.difference_amount),
        status: record.status,
        createdAt: record.created_at,
      },
      { excludeExtraneousValues: true }
    );
  }

  private normalizeExpectedAmount(value: number | null | undefined) {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      return 0;
    }
    return Number(amount.toFixed(2));
  }

  async open(payload: OpenCashSessionDto, actor: FinanceActor) {
    if (!this.canOpenCash(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    await this.assertActiveUser(actor, tenantId);
    await this.assertBranchScope(actor, tenantId, payload.branchId);

    const register = await this.cashRegistersRepository.findById(
      payload.cashRegisterId,
      tenantId
    );
    if (!register) {
      throw new NotFoundException("Caja no encontrada");
    }
    if (!register.activo) {
      throw new BadRequestException("Caja inactiva");
    }
    if (register.branch_id !== payload.branchId) {
      throw new BadRequestException("La caja no pertenece a la sucursal");
    }

    const existingOpen = await this.repository.findOpenByRegister(
      payload.cashRegisterId,
      tenantId
    );
    if (existingOpen) {
      throw new BadRequestException("La caja ya tiene una sesion abierta");
    }

    const currentUserSession = await this.repository.findCurrentByUser(
      actor.userId,
      tenantId
    );
    if (currentUserSession) {
      throw new BadRequestException("El usuario ya tiene una sesion de caja abierta");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const created = await this.repository.create(client, {
        tenantId,
        branchId: payload.branchId,
        cashRegisterId: payload.cashRegisterId,
        openedByUserId: actor.userId,
        openingAmount: payload.openingAmount,
      });

      if (!created) {
        throw new BadRequestException("No se pudo abrir la sesion de caja");
      }

      if (payload.openingAmount > 0) {
        await this.cashMovementsRepository.create(client, {
          tenantId,
          branchId: payload.branchId,
          cashSessionId: created.id,
          movementType: "OPENING",
          direction: "IN",
          amount: payload.openingAmount,
          description: "Apertura de caja",
          createdBy: actor.userId,
        });
      }

      await client.query("COMMIT");

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "cash_sessions",
        entityId: created.id,
        action: "CASH_SESSION_OPENED",
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

  async close(
    cashSessionId: string,
    payload: CloseCashSessionDto,
    actor: FinanceActor
  ) {
    if (!this.canOpenCash(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const current = await this.repository.findById(cashSessionId);
    if (!current) {
      throw new NotFoundException("Sesion de caja no encontrada");
    }

    const tenantId = this.resolveTenantId(actor, current.tenant_id);
    if (tenantId !== current.tenant_id) {
      throw new ForbiddenException("No autorizado");
    }
    if (current.status !== "OPEN") {
      throw new BadRequestException("La sesion de caja no esta abierta");
    }

    await this.assertActiveUser(actor, tenantId);
    await this.assertBranchScope(actor, tenantId, current.branch_id);

    if (!this.canAdminCash(actor) && current.opened_by_user_id !== actor.userId) {
      throw new ForbiddenException("Solo puedes cerrar tu propia caja");
    }

    const summary = await this.repository.getSummary(cashSessionId, tenantId);
    if (!summary) {
      throw new NotFoundException("No se pudo resumir la sesion de caja");
    }

    const expectedAmount = this.normalizeExpectedAmount(
      summary.totals.expectedAmount
    );
    const differenceAmount = Number(
      (payload.closingAmount - expectedAmount).toFixed(2)
    );
    const closedAt = new Date().toISOString();

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const updated = await this.repository.close(client, cashSessionId, {
        closedByUserId: actor.userId,
        closedAt,
        closingAmount: payload.closingAmount,
        expectedAmount,
        differenceAmount,
        status: "CLOSED",
      });

      if (!updated) {
        throw new NotFoundException("Sesion de caja no encontrada");
      }

      await this.repository.createCashCount(client, {
        tenantId,
        branchId: current.branch_id,
        cashSessionId,
        countedByUserId: actor.userId,
        countedAt: closedAt,
        countedCashAmount: payload.closingAmount,
        expectedAmount,
        differenceAmount,
        notes: payload.description?.trim() || null,
      });

      if (payload.closingAmount > 0) {
        await this.cashMovementsRepository.create(client, {
          tenantId,
          branchId: current.branch_id,
          cashSessionId,
          movementType: "CLOSING",
          direction: "OUT",
          amount: payload.closingAmount,
          description: payload.description?.trim() || "Cierre de caja",
          createdBy: actor.userId,
        });
      }

      await client.query("COMMIT");

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "cash_sessions",
        entityId: updated.id,
        action: "CASH_SESSION_CLOSED",
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

  async getCurrent(query: CurrentCashSessionQueryDto, actor: FinanceActor) {
    if (!this.canOpenCash(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const tenantId = this.resolveTenantId(actor);
    if (query.cashRegisterId) {
      const register = await this.cashRegistersRepository.findById(
        query.cashRegisterId,
        tenantId
      );
      if (!register) {
        throw new NotFoundException("Caja no encontrada");
      }
      await this.assertBranchScope(actor, tenantId, register.branch_id);

      const current = await this.repository.findOpenByRegister(
        query.cashRegisterId,
        tenantId
      );
      if (!current) {
        return null;
      }
      if (!this.canAdminCash(actor) && current.opened_by_user_id !== actor.userId) {
        throw new ForbiddenException("No autorizado para esta caja");
      }
      return this.mapResponse(current);
    }

    const current = await this.repository.findCurrentByUser(actor.userId, tenantId);
    if (!current) {
      return null;
    }

    return this.mapResponse(current);
  }

  async getHistory(query: ListCashSessionHistoryDto, actor: FinanceActor) {
    if (!this.canOpenCash(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const tenantId = this.resolveTenantId(actor, query.tenantId);
    if (query.branchId) {
      await this.assertBranchScope(actor, tenantId, query.branchId);
    }
    if (query.cashRegisterId) {
      const register = await this.cashRegistersRepository.findById(
        query.cashRegisterId,
        tenantId
      );
      if (!register) {
        throw new NotFoundException("Caja no encontrada");
      }
      await this.assertBranchScope(actor, tenantId, register.branch_id);
    }

    const records = await this.repository.listHistory({
      tenantId,
      branchId: query.branchId,
      branchIds: await this.resolveAllowedBranchIds(actor, tenantId),
      cashRegisterId: query.cashRegisterId,
      status: query.status,
      openedByUserId: this.canAdminCash(actor) ? undefined : actor.userId,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    });

    return records.map((record) => this.mapResponse(record));
  }

  async getSummary(
    cashSessionId: string,
    actor: FinanceActor
  ): Promise<CashSessionSummaryResponseDto> {
    if (!this.canOpenCash(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const current = await this.repository.findById(cashSessionId);
    if (!current) {
      throw new NotFoundException("Sesion de caja no encontrada");
    }

    const tenantId = this.resolveTenantId(actor, current.tenant_id);
    if (tenantId !== current.tenant_id) {
      throw new ForbiddenException("No autorizado");
    }

    await this.assertActiveUser(actor, tenantId);
    await this.assertBranchScope(actor, tenantId, current.branch_id);

    if (!this.canAdminCash(actor) && current.opened_by_user_id !== actor.userId) {
      throw new ForbiddenException("Solo puedes consultar tu propia caja");
    }

    const summary = await this.repository.getSummary(cashSessionId, tenantId);
    if (!summary) {
      throw new NotFoundException("No se pudo resumir la sesion de caja");
    }

    return summary;
  }
}
