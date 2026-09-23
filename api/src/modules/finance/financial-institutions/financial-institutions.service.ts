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
import { CreateFinancialInstitutionDto } from "./dto/create-financial-institution.dto";
import { FinancialInstitutionResponseDto } from "./dto/financial-institution-response.dto";
import { UpdateFinancialInstitutionDto } from "./dto/update-financial-institution.dto";
import {
  FinancialInstitutionsRepository,
  type FinancialInstitutionRecord,
} from "./financial-institutions.repository";

@Injectable()
export class FinancialInstitutionsService {
  constructor(
    @Inject(FinancialInstitutionsRepository)
    private readonly repository: FinancialInstitutionsRepository,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  private isSuperAdmin(actor: FinanceActor) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private canManageTenant(actor: FinanceActor) {
    return this.isSuperAdmin(actor) || actor.roles.includes("SUPER_USER");
  }

  private canRead(actor: FinanceActor) {
    return this.canManageTenant(actor) || actor.roles.includes("ADMIN") || actor.roles.includes("USER");
  }

  private resolveTenantId(actor: FinanceActor, tenantId?: string) {
    if (this.isSuperAdmin(actor)) {
      return tenantId?.trim() || actor.tenantId;
    }
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    return actor.tenantId;
  }

  private mapResponse(record: FinancialInstitutionRecord) {
    return plainToInstance(
      FinancialInstitutionResponseDto,
      {
        id: record.id,
        tenantId: record.tenant_id,
        codigo: record.codigo,
        nombre: record.nombre,
        nombreCorto: record.nombre_corto,
        tipo: record.tipo,
        logoUrl: record.logo_url,
        active: record.active,
        sortOrder: record.sort_order,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      },
      { excludeExtraneousValues: true }
    );
  }

  async list(actor: FinanceActor, paymentMethodId?: string, active?: boolean) {
    if (!this.canRead(actor)) throw new ForbiddenException("No autorizado");
    const tenantId = this.resolveTenantId(actor);
    const records = await this.repository.list(tenantId, paymentMethodId, active);
    return records.map((rec) => this.mapResponse(rec));
  }

  async create(payload: CreateFinancialInstitutionDto, actor: FinanceActor) {
    if (!this.canManageTenant(actor)) throw new ForbiddenException("No autorizado");
    const tenantId = this.resolveTenantId(actor, payload.tenantId);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const created = await this.repository.create(client, {
        tenantId,
        codigo: payload.codigo,
        nombre: payload.nombre,
        nombreCorto: payload.nombreCorto,
        tipo: payload.tipo,
        logoUrl: payload.logoUrl,
        active: payload.active ?? true,
        sortOrder: payload.sortOrder ?? 0,
      });
      await client.query("COMMIT");

      if (!created) throw new BadRequestException("No se pudo crear la institucion financiera");

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "financial_institutions",
        entityId: created.id,
        action: "FINANCIAL_INSTITUTION_CREATED",
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

  async update(id: string, payload: UpdateFinancialInstitutionDto, actor: FinanceActor) {
    if (!this.canManageTenant(actor)) throw new ForbiddenException("No autorizado");
    const current = await this.repository.findById(id);
    if (!current) throw new NotFoundException("Institucion financiera no encontrada");

    const tenantId = this.resolveTenantId(actor);
    if (current.tenant_id === null && !this.isSuperAdmin(actor)) {
      throw new ForbiddenException("Solo SUPER_ADMIN puede modificar entidades globales");
    }
    if (current.tenant_id !== null && current.tenant_id !== tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const updated = await this.repository.update(client, id, payload);
      await client.query("COMMIT");

      if (!updated) throw new NotFoundException("Institucion financiera no encontrada");

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "financial_institutions",
        entityId: updated.id,
        action: "FINANCIAL_INSTITUTION_UPDATED",
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

  async remove(id: string, actor: FinanceActor) {
    if (!this.canManageTenant(actor)) throw new ForbiddenException("No autorizado");
    return this.update(id, { active: false }, actor);
  }

  async setPaymentMethodMappings(paymentMethodId: string, financialInstitutionIds: string[], actor: FinanceActor) {
    if (!this.canManageTenant(actor)) throw new ForbiddenException("No autorizado");
    const tenantId = this.resolveTenantId(actor);
    const uniqueInstitutionIds = [...new Set(financialInstitutionIds)];

    const paymentMethod = await this.db.query<{ tenant_id: string }>(
      "SELECT tenant_id FROM payment_methods WHERE id = $1 LIMIT 1",
      [paymentMethodId]
    );
    if (!paymentMethod.rows[0]) throw new NotFoundException("Metodo de pago no encontrado");
    if (paymentMethod.rows[0].tenant_id !== tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }

    if (uniqueInstitutionIds.length > 0) {
      const allowedInstitutions = await this.db.query<{ id: string }>(
        `SELECT id
         FROM financial_institutions
         WHERE id = ANY($1::uuid[])
           AND active = TRUE
           AND (tenant_id = $2 OR tenant_id IS NULL)`,
        [uniqueInstitutionIds, tenantId]
      );
      if (allowedInstitutions.rows.length !== uniqueInstitutionIds.length) {
        throw new BadRequestException("Una o mas entidades financieras no son validas para el tenant");
      }
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await this.repository.setPaymentMethodMappings(client, tenantId, paymentMethodId, uniqueInstitutionIds);
      await client.query("COMMIT");
      return { success: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
