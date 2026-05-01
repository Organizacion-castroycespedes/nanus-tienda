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
import { CreatePaymentMethodDto } from "./dto/create-payment-method.dto";
import { ListPaymentMethodsDto } from "./dto/list-payment-methods.dto";
import { PaymentMethodResponseDto } from "./dto/payment-method-response.dto";
import { UpdatePaymentMethodDto } from "./dto/update-payment-method.dto";
import {
  PaymentMethodsRepository,
  type PaymentMethodRecord,
} from "./payment-methods.repository";

@Injectable()
export class PaymentMethodsService {
  constructor(
    @Inject(PaymentMethodsRepository)
    private readonly repository: PaymentMethodsRepository,
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

    if (tenantId && tenantId.trim() !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }

    return actor.tenantId;
  }

  private assertManageAccess(actor: FinanceActor) {
    if (!this.canManageTenant(actor)) {
      throw new ForbiddenException("No autorizado");
    }
  }

  private assertReadAccess(actor: FinanceActor) {
    if (!this.canRead(actor)) {
      throw new ForbiddenException("No autorizado");
    }
  }

  private normalizeRequired(value: string | undefined, message: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(message);
    }
    return normalized;
  }

  private mapResponse(record: PaymentMethodRecord) {
    return plainToInstance(
      PaymentMethodResponseDto,
      {
        id: record.id,
        tenantId: record.tenant_id,
        codigo: record.codigo,
        nombre: record.nombre,
        tipo: record.tipo,
        requiresReference: record.requires_reference,
        allowsChange: record.allows_change,
        active: record.active,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      },
      { excludeExtraneousValues: true }
    );
  }

  private async assertUniqueCode(
    tenantId: string,
    codigo: string,
    excludeId?: string
  ) {
    const exists = await this.repository.existsCode(tenantId, codigo, excludeId);
    if (exists) {
      throw new BadRequestException("Codigo ya registrado");
    }
  }

  async create(payload: CreatePaymentMethodDto, actor: FinanceActor) {
    this.assertManageAccess(actor);
    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    const codigo = this.normalizeRequired(payload.codigo, "Codigo requerido");
    const nombre = this.normalizeRequired(payload.nombre, "Nombre requerido");

    if (payload.tipo === "CREDIT" && payload.allowsChange === true) {
      throw new BadRequestException("Metodos de credito no permiten cambio");
    }

    await this.assertUniqueCode(tenantId, codigo);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const created = await this.repository.create(client, {
        tenantId,
        codigo,
        nombre,
        tipo: payload.tipo,
        requiresReference: payload.requiresReference ?? false,
        allowsChange: payload.allowsChange ?? false,
        active: payload.active ?? true,
      });

      await client.query("COMMIT");

      if (!created) {
        throw new BadRequestException("No se pudo crear el metodo de pago");
      }

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "payment_methods",
        entityId: created.id,
        action: "PAYMENT_METHOD_CREATED",
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

  async list(filters: ListPaymentMethodsDto, actor: FinanceActor) {
    this.assertReadAccess(actor);
    const tenantId = this.resolveTenantId(actor, filters.tenantId);
    const active =
      filters.active === undefined ? undefined : filters.active === "true";
    const records = await this.repository.list(tenantId, active);
    return records.map((record) => this.mapResponse(record));
  }

  async update(
    paymentMethodId: string,
    payload: UpdatePaymentMethodDto,
    actor: FinanceActor
  ) {
    this.assertManageAccess(actor);
    const current = await this.repository.findById(paymentMethodId);

    if (!current) {
      throw new NotFoundException("Metodo de pago no encontrado");
    }

    const tenantId = this.resolveTenantId(actor, current.tenant_id);
    if (tenantId !== current.tenant_id) {
      throw new ForbiddenException("No autorizado");
    }

    const nextCodigo =
      payload.codigo !== undefined
        ? this.normalizeRequired(payload.codigo, "Codigo requerido")
        : current.codigo;

    const nextNombre =
      payload.nombre !== undefined
        ? this.normalizeRequired(payload.nombre, "Nombre requerido")
        : current.nombre;

    const nextTipo = payload.tipo ?? current.tipo;
    const nextAllowsChange = payload.allowsChange ?? current.allows_change;

    if (
      nextTipo === "CREDIT" &&
      nextAllowsChange
    ) {
      throw new BadRequestException("Metodos de credito no permiten cambio");
    }

    await this.assertUniqueCode(tenantId, nextCodigo, paymentMethodId);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const updated = await this.repository.update(client, paymentMethodId, {
        codigo: payload.codigo !== undefined ? nextCodigo : undefined,
        nombre: payload.nombre !== undefined ? nextNombre : undefined,
        tipo: payload.tipo,
        requiresReference: payload.requiresReference,
        allowsChange: payload.allowsChange,
        active: payload.active,
      });
      await client.query("COMMIT");

      if (!updated) {
        throw new NotFoundException("Metodo de pago no encontrado");
      }

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "payment_methods",
        entityId: updated.id,
        action: "PAYMENT_METHOD_UPDATED",
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

  async remove(paymentMethodId: string, actor: FinanceActor) {
    this.assertManageAccess(actor);
    const current = await this.repository.findById(paymentMethodId);
    if (!current) {
      throw new NotFoundException("Metodo de pago no encontrado");
    }

    const tenantId = this.resolveTenantId(actor, current.tenant_id);
    if (tenantId !== current.tenant_id) {
      throw new ForbiddenException("No autorizado");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const updated = await this.repository.update(client, paymentMethodId, {
        active: false,
      });
      await client.query("COMMIT");

      if (!updated) {
        throw new NotFoundException("Metodo de pago no encontrado");
      }

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "payment_methods",
        entityId: updated.id,
        action: "PAYMENT_METHOD_DEACTIVATED",
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
