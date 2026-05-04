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
import { CashRegistersRepository } from "../cash-registers/cash-registers.repository";
import { CashSessionsRepository } from "../cash-sessions/cash-sessions.repository";
import { CashMovementResponseDto } from "./dto/cash-movement-response.dto";
import { CreateCashMovementDto } from "./dto/create-cash-movement.dto";
import { ListCashMovementsDto } from "./dto/list-cash-movements.dto";
import {
  CashMovementsRepository,
  type CashMovementRecord,
} from "./cash-movements.repository";

@Injectable()
export class CashMovementsService {
  constructor(
    @Inject(CashMovementsRepository)
    private readonly repository: CashMovementsRepository,
    @Inject(CashSessionsRepository)
    private readonly sessionsRepository: CashSessionsRepository,
    @Inject(CashRegistersRepository)
    private readonly cashRegistersRepository: CashRegistersRepository,
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

  private canOperate(actor: FinanceActor) {
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

  private async assertBranchScope(
    actor: FinanceActor,
    tenantId: string,
    branchId: string
  ) {
    const branch = await this.accessRepository.findBranchById(branchId, tenantId);
    if (!branch) {
      throw new BadRequestException("Sucursal invalida");
    }
    if (this.canAdminCash(actor)) {
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
    if (this.canAdminCash(actor)) {
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

  private mapResponse(record: CashMovementRecord) {
    return plainToInstance(
      CashMovementResponseDto,
      {
        id: record.id,
        tenantId: record.tenant_id,
        branchId: record.branch_id,
        cashSessionId: record.cash_session_id,
        paymentId: record.payment_id,
        cashRegisterId: record.cash_register_id,
        cashRegisterNombre: record.cash_register_nombre,
        movementType: record.movement_type,
        direction: record.direction,
        referenceType: record.reference_type,
        referenceId: record.reference_id,
        amount: Number(record.amount),
        description: record.description,
        createdBy: record.created_by,
        createdByEmail: record.created_by_email,
        createdAt: record.created_at,
      },
      { excludeExtraneousValues: true }
    );
  }

  async create(payload: CreateCashMovementDto, actor: FinanceActor) {
    if (!this.canOperate(actor)) {
      throw new ForbiddenException("No autorizado");
    }
    if (
      payload.movementType === "OPENING" ||
      payload.movementType === "CLOSING" ||
      payload.movementType === "PAYMENT"
    ) {
      throw new BadRequestException(
        "Los movimientos internos de apertura, cierre y pago se generan automaticamente"
      );
    }

    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    const session = await this.sessionsRepository.findById(payload.cashSessionId, tenantId);
    if (!session) {
      throw new NotFoundException("Sesion de caja no encontrada");
    }
    if (session.status !== "OPEN") {
      throw new BadRequestException("La sesion de caja no esta abierta");
    }

    await this.assertBranchScope(actor, tenantId, session.branch_id);

    if (!this.canAdminCash(actor) && session.opened_by_user_id !== actor.userId) {
      throw new ForbiddenException("Solo puedes registrar movimientos en tu caja");
    }

    const register = await this.cashRegistersRepository.findById(
      session.cash_register_id,
      tenantId
    );
    if (!register || !register.activo) {
      throw new BadRequestException("Caja no disponible");
    }

    if ((payload.referenceType == null) !== (payload.referenceId == null)) {
      throw new BadRequestException("referenceType y referenceId deben enviarse juntos");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const created = await this.repository.create(client, {
        tenantId,
        branchId: session.branch_id,
        cashSessionId: session.id,
        paymentId: null,
        movementType: payload.movementType,
        direction: payload.direction,
        referenceType: payload.referenceType ?? null,
        referenceId: payload.referenceId ?? null,
        amount: payload.amount,
        description: payload.description?.trim() || null,
        createdBy: actor.userId,
      });
      await client.query("COMMIT");

      if (!created) {
        throw new BadRequestException("No se pudo crear el movimiento");
      }

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "cash_movements",
        entityId: created.id,
        action: "CASH_MOVEMENT_CREATED",
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

  async list(filters: ListCashMovementsDto, actor: FinanceActor) {
    if (!this.canOperate(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const tenantId = this.resolveTenantId(actor, filters.tenantId);
    if (filters.branchId) {
      await this.assertBranchScope(actor, tenantId, filters.branchId);
    }

    if (filters.cashSessionId) {
      const session = await this.sessionsRepository.findById(filters.cashSessionId, tenantId);
      if (!session) {
        throw new NotFoundException("Sesion de caja no encontrada");
      }
      if (!this.canAdminCash(actor) && session.opened_by_user_id !== actor.userId) {
        throw new ForbiddenException("No autorizado para esta sesion");
      }
    }

    if (filters.cashRegisterId) {
      const register = await this.cashRegistersRepository.findById(
        filters.cashRegisterId,
        tenantId
      );
      if (!register) {
        throw new NotFoundException("Caja no encontrada");
      }
      await this.assertBranchScope(actor, tenantId, register.branch_id);
    }

    const records = await this.repository.list({
      tenantId,
      branchId: filters.branchId,
      branchIds: await this.resolveAllowedBranchIds(actor, tenantId),
      cashRegisterId: filters.cashRegisterId,
      cashSessionId: filters.cashSessionId,
      movementType: filters.movementType,
      direction: filters.direction,
      createdBy: this.canAdminCash(actor) ? undefined : actor.userId,
      limit: filters.limit ?? 100,
      offset: filters.offset ?? 0,
    });

    return records.map((record) => this.mapResponse(record));
  }
}
