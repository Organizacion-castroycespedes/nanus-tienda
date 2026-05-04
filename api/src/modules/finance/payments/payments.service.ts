import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { AuditService } from "../../../common/services/audit.service";
import type { FinanceActor } from "../common/finance.types";
import {
  FinanceAccessRepository,
  type FinanceBranchRecord,
} from "../common/repositories/finance-access.repository";
import { CashMovementsRepository } from "../cash-movements/cash-movements.repository";
import { CashSessionsRepository } from "../cash-sessions/cash-sessions.repository";
import {
  PAYMENT_REFERENCE_TYPES,
  type PaymentReferenceType,
} from "../entities/payment.entity";
import { PaymentMethodsRepository } from "../payment-methods/payment-methods.repository";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import {
  PaymentAllocationResponseDto,
  PaymentResponseDto,
} from "./dto/payment-response.dto";
import { ListPaymentsDto } from "./dto/list-payments.dto";
import {
  PaymentsRepository,
  type PaymentAllocationRecord,
  type PaymentDocumentRecord,
  type PaymentRecord,
} from "./payments.repository";

type ReferenceSummary = {
  key: string;
  referenceType: PaymentReferenceType;
  referenceId: string;
  allocatedAmount: number;
};

type ResolvedReference = {
  referenceType: PaymentReferenceType;
  referenceId: string;
  document: PaymentDocumentRecord;
  alreadyAllocated: number;
  dueBefore: number;
};

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PaymentsRepository)
    private readonly repository: PaymentsRepository,
    @Inject(PaymentMethodsRepository)
    private readonly paymentMethodsRepository: PaymentMethodsRepository,
    @Inject(CashSessionsRepository)
    private readonly cashSessionsRepository: CashSessionsRepository,
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

  private canAdminPayments(actor: FinanceActor) {
    return this.canManageTenant(actor) || actor.roles.includes("ADMIN");
  }

  private canOperatePayments(actor: FinanceActor) {
    return this.canAdminPayments(actor) || actor.roles.includes("USER");
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
  ): Promise<FinanceBranchRecord> {
    const branch = await this.accessRepository.findBranchById(branchId, tenantId);
    if (!branch) {
      throw new BadRequestException("Sucursal invalida");
    }
    if (branch.estado !== "ACTIVE") {
      throw new BadRequestException("Sucursal inactiva");
    }
    if (this.canAdminPayments(actor)) {
      return branch;
    }

    const allowed = await this.accessRepository.userHasBranchAccess(
      actor.userId,
      tenantId,
      branchId
    );
    if (!allowed) {
      throw new ForbiddenException("No autorizado para esta sucursal");
    }
    return branch;
  }

  private async resolveAllowedBranchIds(actor: FinanceActor, tenantId: string) {
    if (this.canAdminPayments(actor)) {
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

  private async assertActiveUser(actor: FinanceActor, tenantId: string) {
    const user = await this.accessRepository.findUserById(actor.userId, tenantId);
    if (!user || user.estado !== "ACTIVE") {
      throw new ForbiddenException("Usuario no autorizado");
    }
  }

  private buildReferenceKey(referenceType: PaymentReferenceType, referenceId: string) {
    return `${referenceType}:${referenceId}`;
  }

  private isSupportedReferenceType(referenceType: PaymentReferenceType) {
    return (
      referenceType === "SALE" ||
      referenceType === "PURCHASE" ||
      referenceType === "PURCHASE_ORDER" ||
      referenceType === "SALES_ORDER"
    );
  }

  private normalizeOptional(value: string | null | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async resolveImplicitCashSession(
    actor: FinanceActor,
    tenantId: string,
    branchId: string,
    existingClient?: PoolClient
  ) {
    const currentSession = await this.cashSessionsRepository.findCurrentByUser(
      actor.userId,
      tenantId
    );

    if (!currentSession) {
      return null;
    }

    if (currentSession.status !== "OPEN") {
      return null;
    }

    if (currentSession.branch_id !== branchId) {
      return null;
    }

    return this.cashSessionsRepository.findById(currentSession.id, tenantId, existingClient);
  }

  private computeDueBefore(
    document: PaymentDocumentRecord,
    alreadyAllocated: number
  ) {
    const total = Number(document.total);
    const balance = document.balance === null ? null : Number(document.balance);

    if (balance !== null) {
      return Math.max(0, Math.min(balance, total - alreadyAllocated));
    }

    return Math.max(0, total - alreadyAllocated);
  }

  private mapAllocation(record: PaymentAllocationRecord) {
    return plainToInstance(
      PaymentAllocationResponseDto,
      {
        id: record.id,
        paymentId: record.payment_id,
        referenceType: record.reference_type,
        referenceId: record.reference_id,
        allocatedAmount: Number(record.allocated_amount),
        createdAt: record.created_at,
      },
      { excludeExtraneousValues: true }
    );
  }

  private mapPayment(record: PaymentRecord, allocations: PaymentAllocationRecord[]) {
    const mappedAllocations = allocations
      .filter((allocation) => allocation.payment_id === record.id)
      .map((allocation) => this.mapAllocation(allocation));

    const allocatedAmount = mappedAllocations.reduce(
      (sum, allocation) => sum + allocation.allocatedAmount,
      0
    );

    return plainToInstance(
      PaymentResponseDto,
      {
        id: record.id,
        tenantId: record.tenant_id,
        branchId: record.branch_id,
        paymentMethodId: record.payment_method_id,
        paymentMethodCodigo: record.payment_method_codigo,
        paymentMethodNombre: record.payment_method_nombre,
        paymentMethodTipo: record.payment_method_tipo,
        cashSessionId: record.cash_session_id,
        cashRegisterId: record.cash_register_id,
        cashRegisterNombre: record.cash_register_nombre,
        referenceType: record.reference_type,
        referenceId: record.reference_id,
        direction: record.direction,
        status: record.status,
        amount: Number(record.amount),
        allocatedAmount,
        unallocatedAmount: Number(record.amount) - allocatedAmount,
        referenceNumber: record.reference_number,
        notes: record.notes,
        paidByPersonId: record.paid_by_person_id,
        paidByPersonName: record.paid_by_person_name,
        createdBy: record.created_by,
        createdByEmail: record.created_by_email,
        createdAt: record.created_at,
        allocations: mappedAllocations,
      },
      { excludeExtraneousValues: true }
    );
  }

  private async resolveReferenceDocument(
    tenantId: string,
    referenceType: PaymentReferenceType,
    referenceId: string,
    client?: PoolClient
  ) {
    if (!this.isSupportedReferenceType(referenceType)) {
      throw new BadRequestException(
        `referenceType ${referenceType} no esta soportado todavia por el motor de pagos`
      );
    }

    const document = await this.repository.findReferenceDocument(
      tenantId,
      referenceType,
      referenceId,
      client
    );
    if (!document) {
      throw new NotFoundException("Documento de referencia no encontrado");
    }
    if (document.status === "CANCELLED") {
      throw new BadRequestException("No se permiten pagos sobre documentos cancelados");
    }
    return document;
  }

  private aggregateAllocations(items: ReferenceSummary[]) {
    const map = new Map<string, ReferenceSummary>();

    for (const item of items) {
      const existing = map.get(item.key);
      if (!existing) {
        map.set(item.key, { ...item });
        continue;
      }
      existing.allocatedAmount += item.allocatedAmount;
    }

    return Array.from(map.values());
  }

  private buildRequestedAllocations(payload: CreatePaymentDto, dueBefore: number) {
    const allocations = (payload.allocations ?? []).map((allocation) => ({
      key: this.buildReferenceKey(allocation.referenceType, allocation.referenceId),
      referenceType: allocation.referenceType,
      referenceId: allocation.referenceId,
      allocatedAmount: allocation.allocatedAmount,
    }));

    if (allocations.length > 0) {
      return allocations;
    }

    const defaultAmount =
      payload.allowOverpayment === true ? Math.min(payload.amount, dueBefore) : payload.amount;

    if (defaultAmount <= 0) {
      return [] as ReferenceSummary[];
    }

    return [
      {
        key: this.buildReferenceKey(payload.referenceType, payload.referenceId),
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        allocatedAmount: defaultAmount,
      },
    ];
  }

  private async resolveReferences(
    tenantId: string,
    branchId: string,
    requestedAllocations: ReferenceSummary[],
    client?: PoolClient
  ) {
    const resolved = new Map<string, ResolvedReference>();

    for (const allocation of this.aggregateAllocations(requestedAllocations)) {
      const document = await this.resolveReferenceDocument(
        tenantId,
        allocation.referenceType,
        allocation.referenceId,
        client
      );
      if (document.branch_id && document.branch_id !== branchId) {
        throw new BadRequestException(
          "El documento de referencia no pertenece a la sucursal indicada"
        );
      }
      const alreadyAllocated = await this.repository.sumAllocatedForReference(
        tenantId,
        allocation.referenceType,
        allocation.referenceId,
        client
      );
      resolved.set(allocation.key, {
        referenceType: allocation.referenceType,
        referenceId: allocation.referenceId,
        document,
        alreadyAllocated,
        dueBefore: this.computeDueBefore(document, alreadyAllocated),
      });
    }

    return resolved;
  }

  private async reconcileDocumentBalances(
    client: PoolClient,
    tenantId: string,
    references: Map<string, ResolvedReference>,
    requestedAllocations: ReferenceSummary[]
  ) {
    const aggregated = this.aggregateAllocations(requestedAllocations);

    for (const allocation of aggregated) {
      const resolved = references.get(allocation.key);
      if (!resolved) {
        continue;
      }

      if (resolved.referenceType === "SALE") {
        await this.repository.syncSaleFinancialState(client, resolved.referenceId, tenantId);
      } else if (
        resolved.referenceType === "PURCHASE" ||
        resolved.referenceType === "PURCHASE_ORDER"
      ) {
        await this.repository.syncPurchaseFinancialState(
          client,
          resolved.referenceId,
          tenantId
        );
      } else if (resolved.referenceType === "SALES_ORDER") {
        await this.repository.syncOrderFinancialState(client, resolved.referenceId, tenantId);
      }
    }
  }

  async createInTransaction(
    payload: CreatePaymentDto,
    actor: FinanceActor,
    client: PoolClient
  ) {
    return this.createInternal(payload, actor, client);
  }

  private async createInternal(
    payload: CreatePaymentDto,
    actor: FinanceActor,
    existingClient?: PoolClient
  ) {
    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    await this.assertActiveUser(actor, tenantId);
    await this.assertBranchScope(actor, tenantId, payload.branchId);

    const paymentMethod = await this.paymentMethodsRepository.findById(
      payload.paymentMethodId,
      tenantId,
      existingClient
    );
    if (!paymentMethod) {
      throw new NotFoundException("Metodo de pago no encontrado");
    }
    if (!paymentMethod.active) {
      throw new BadRequestException("Metodo de pago inactivo");
    }

    const status = payload.status ?? "COMPLETED";

    let cashSession: Awaited<ReturnType<CashSessionsRepository["findById"]>> | null = null;
    const resolvedCashSessionId =
      payload.cashSessionId ??
      (
        await this.resolveImplicitCashSession(
          actor,
          tenantId,
          payload.branchId,
          existingClient
        )
      )?.id ??
      null;

    if (paymentMethod.tipo === "CASH" && !resolvedCashSessionId) {
      throw new BadRequestException("cashSessionId es requerido para pagos en efectivo");
    }

    if (status === "COMPLETED" && paymentMethod.tipo === "CASH" && !resolvedCashSessionId) {
      throw new BadRequestException("cashSessionId es requerido para pagos en efectivo");
    }

    if (resolvedCashSessionId) {
      cashSession = await this.cashSessionsRepository.findById(
        resolvedCashSessionId,
        tenantId,
        existingClient
      );
      if (!cashSession) {
        throw new NotFoundException("Sesion de caja no encontrada");
      }
      if (cashSession.status !== "OPEN") {
        throw new BadRequestException("La sesion de caja no esta abierta");
      }
      if (cashSession.branch_id !== payload.branchId) {
        throw new BadRequestException("La sesion de caja no pertenece a la sucursal");
      }
      if (!this.canAdminPayments(actor) && cashSession.opened_by_user_id !== actor.userId) {
        throw new ForbiddenException("Solo puedes registrar pagos sobre tu caja");
      }
    }

    if (payload.paidByPersonId) {
      const person = await this.accessRepository.findPersonById(
        payload.paidByPersonId,
        tenantId,
        existingClient
      );
      if (!person) {
        throw new BadRequestException("Persona pagadora invalida");
      }
    }

    const primaryDocument = await this.resolveReferenceDocument(
      tenantId,
      payload.referenceType,
      payload.referenceId,
      existingClient
    );
    if (primaryDocument.branch_id && primaryDocument.branch_id !== payload.branchId) {
      throw new BadRequestException(
        "El documento principal no pertenece a la sucursal indicada"
      );
    }
    const primaryAllocated = await this.repository.sumAllocatedForReference(
      tenantId,
      payload.referenceType,
      payload.referenceId,
      existingClient
    );
    const primaryDueBefore = this.computeDueBefore(primaryDocument, primaryAllocated);

    const requestedAllocations = this.buildRequestedAllocations(payload, primaryDueBefore);
    const allocatedAmount = requestedAllocations.reduce(
      (sum, allocation) => sum + allocation.allocatedAmount,
      0
    );

    if (allocatedAmount > payload.amount) {
      throw new BadRequestException("El total asignado no puede superar el monto del pago");
    }

    const unallocatedAmount = Number((payload.amount - allocatedAmount).toFixed(2));
    if (unallocatedAmount > 0 && payload.allowOverpayment !== true) {
      throw new BadRequestException(
        "El pago supera el monto asignado. Usa allowOverpayment para permitir sobrantes controlados"
      );
    }

    const references = await this.resolveReferences(
      tenantId,
      payload.branchId,
      requestedAllocations,
      existingClient
    );

    for (const allocation of this.aggregateAllocations(requestedAllocations)) {
      const resolved = references.get(allocation.key);
      if (!resolved) {
        throw new BadRequestException("No se pudo resolver una asignacion de pago");
      }
      if (allocation.allocatedAmount > resolved.dueBefore) {
        throw new BadRequestException(
          "Una asignacion excede el saldo permitido del documento"
        );
      }
    }

    const client = existingClient ?? (await this.db.getClient());
    const ownsTransaction = !existingClient;

    try {
      if (ownsTransaction) {
        await client.query("BEGIN");
      }

      const created = await this.repository.createPayment(client, {
        tenantId,
        branchId: payload.branchId,
        paymentMethodId: payload.paymentMethodId,
        cashSessionId: resolvedCashSessionId,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        direction: payload.direction,
        status,
        amount: payload.amount,
        referenceNumber: this.normalizeOptional(payload.referenceNumber),
        notes: this.normalizeOptional(payload.notes),
        paidByPersonId: payload.paidByPersonId ?? null,
        createdBy: actor.userId,
      });

      if (!created) {
        throw new BadRequestException("No se pudo crear el pago");
      }

      const createdAllocations = await this.repository.createAllocations(
        client,
        created.id,
        requestedAllocations.map((allocation) => ({
          referenceType: allocation.referenceType,
          referenceId: allocation.referenceId,
          allocatedAmount: allocation.allocatedAmount,
        }))
      );

      if (status === "COMPLETED" && cashSession) {
        await this.cashMovementsRepository.create(client, {
          tenantId,
          branchId: payload.branchId,
          cashSessionId: cashSession.id,
          paymentId: created.id,
          movementType: "PAYMENT",
          direction: payload.direction,
          referenceType: payload.referenceType,
          referenceId: payload.referenceId,
          amount: payload.amount,
          description:
            this.normalizeOptional(payload.notes) ??
            `Pago ${payload.referenceType.toLowerCase()}`,
          createdBy: actor.userId,
        });
      }

      await this.reconcileDocumentBalances(
        client,
        tenantId,
        references,
        requestedAllocations
      );

      if (ownsTransaction) {
        await client.query("COMMIT");
      }

      const response = this.mapPayment(created, createdAllocations);

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "payments",
        entityId: created.id,
        action: "PAYMENT_CREATED",
        after: {
          ...response,
          overpaymentAmount: unallocatedAmount,
        },
      });

      return response;
    } catch (error) {
      if (ownsTransaction) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      if (ownsTransaction) {
        client.release();
      }
    }
  }

  async create(payload: CreatePaymentDto, actor: FinanceActor) {
    if (!this.canOperatePayments(actor)) {
      throw new ForbiddenException("No autorizado");
    }
    return this.createInternal(payload, actor);
  }

  async getById(paymentId: string, actor: FinanceActor) {
    if (!this.canOperatePayments(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const record = await this.repository.findById(paymentId);
    if (!record) {
      throw new NotFoundException("Pago no encontrado");
    }

    const tenantId = this.resolveTenantId(actor, record.tenant_id);
    if (record.tenant_id !== tenantId) {
      throw new ForbiddenException("No autorizado");
    }
    await this.assertBranchScope(actor, tenantId, record.branch_id);

    if (!this.canAdminPayments(actor) && record.created_by !== actor.userId) {
      throw new ForbiddenException("Solo puedes ver tus propios pagos");
    }

    const allocations = await this.repository.listAllocationsByPaymentIds([record.id]);
    return this.mapPayment(record, allocations);
  }

  async list(filters: ListPaymentsDto, actor: FinanceActor) {
    if (!this.canOperatePayments(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const tenantId = this.resolveTenantId(actor, filters.tenantId);
    if (filters.branchId) {
      await this.assertBranchScope(actor, tenantId, filters.branchId);
    }

    const records = await this.repository.list({
      tenantId,
      branchId: filters.branchId,
      branchIds: await this.resolveAllowedBranchIds(actor, tenantId),
      paymentMethodId: filters.paymentMethodId,
      cashSessionId: filters.cashSessionId,
      referenceType: filters.referenceType,
      referenceId: filters.referenceId,
      direction: filters.direction,
      status: filters.status,
      createdBy: this.canAdminPayments(actor) ? undefined : actor.userId,
      limit: filters.limit ?? 100,
      offset: filters.offset ?? 0,
    });

    const allocations = await this.repository.listAllocationsByPaymentIds(
      records.map((record) => record.id)
    );

    return records.map((record) => this.mapPayment(record, allocations));
  }
}
