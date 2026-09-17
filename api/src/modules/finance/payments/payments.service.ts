import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
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
import { CreateDocumentPaymentDto } from "./dto/create-document-payment.dto";
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
    branchId: string,
    client?: PoolClient,
  ): Promise<FinanceBranchRecord> {
    const branch = await this.accessRepository.findBranchById(branchId, tenantId, client);
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
      branchId,
      client,
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

  private async assertActiveUser(actor: FinanceActor, tenantId: string, client?: PoolClient) {
    const user = await this.accessRepository.findUserById(actor.userId, tenantId, client);
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
      return Math.max(0, Math.min(balance, Number((total - alreadyAllocated).toFixed(2))));
    }

    return Math.max(0, Number((total - alreadyAllocated).toFixed(2)));
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
    existingClient?: PoolClient,
    deferAudit = false,
  ) {
    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    if ((payload.referenceType === "PURCHASE" || payload.referenceType === "PURCHASE_ORDER") && payload.direction !== "OUT") {
      throw new BadRequestException("Los pagos de compra deben usar direccion OUT");
    }
    if (payload.referenceType === "SALES_ORDER" && payload.direction !== "IN") {
      throw new BadRequestException("Los cobros de pedido deben usar direccion IN");
    }
    if (existingClient) {
      const references = [
        { referenceType: payload.referenceType, referenceId: payload.referenceId },
        ...(payload.allocations ?? []),
      ].sort((a, b) => `${a.referenceType}:${a.referenceId}`.localeCompare(`${b.referenceType}:${b.referenceId}`));
      for (const reference of references) {
        await this.repository.lockDocument(existingClient, tenantId, reference.referenceType, reference.referenceId);
      }
    }
    await this.assertActiveUser(actor, tenantId, existingClient);
    await this.assertBranchScope(actor, tenantId, payload.branchId, existingClient);

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

      if (!deferAudit) this.auditService.logEvent({
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
    const hasDocument = [payload, ...(payload.allocations ?? [])].some(
      (item) => ["PURCHASE", "PURCHASE_ORDER", "SALES_ORDER"].includes(item.referenceType),
    );
    if (!hasDocument) return this.createInternal(payload, actor);
    // Legacy document writers acquire the same lock before reading balance.
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const response = await this.createInternal(payload, actor, client, true);
      await client.query("COMMIT");
      this.logCommittedDocumentPayments(actor, [response]);
      return response;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private buildDocumentPaymentFingerprint(payload: CreateDocumentPaymentDto) {
    const lines = [...payload.payments]
      .map((line) => ({
        paymentMethodId: line.paymentMethodId,
        amount: Number(line.amount).toFixed(2),
        referenceNumber: this.normalizeOptional(line.referenceNumber) ?? null,
        notes: this.normalizeOptional(line.notes) ?? null,
      }))
      .sort((a, b) => {
        const left = JSON.stringify(a);
        const right = JSON.stringify(b);
        return left < right ? -1 : left > right ? 1 : 0;
      });
    const canonical = JSON.stringify({
      branchId: payload.branchId,
      cashSessionId: payload.cashSessionId,
      referenceType: payload.referenceType,
      referenceId: payload.referenceId,
      payments: lines,
    });
    return createHash("sha256").update(canonical, "utf8").digest("hex");
  }

  private logCommittedDocumentPayments(actor: FinanceActor, payments: PaymentResponseDto[]) {
    for (const payment of payments) {
      this.auditService.logEvent({
        tenantId: payment.tenantId, userId: actor.userId, module: "finance",
        entity: "payments", entityId: payment.id, action: "PAYMENT_CREATED", after: payment,
      });
    }
  }

  async createDocument(payload: CreateDocumentPaymentDto, actor: FinanceActor) {
    if (!this.canOperatePayments(actor)) throw new ForbiddenException("No autorizado");
    if (!["PURCHASE", "SALES_ORDER"].includes(payload.referenceType)) {
      throw new BadRequestException("Documento no soportado");
    }
    if (!payload.payments?.length || payload.payments.length > 50 || payload.payments.some(
      (line) => !Number.isFinite(line.amount) || line.amount <= 0 ||
        line.amount > 999999999999.99 || Number(line.amount.toFixed(2)) !== line.amount,
    )) throw new BadRequestException("Los pagos deben tener montos positivos con maximo dos decimales");

    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    const operationKey = payload.operationKey ?? randomUUID();
    const requestFingerprint = this.buildDocumentPaymentFingerprint(payload);
    const client = await this.db.getClient();
    let responses: PaymentResponseDto[];
    try {
      await client.query("BEGIN");
      const operation = await this.repository.claimDocumentPaymentOperation(client, {
        tenantId,
        operationKey,
        requestFingerprint,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
      });
      if (!operation.record) {
        throw new BadRequestException("No se pudo registrar la operacion de pago");
      }
      if (operation.record.request_fingerprint !== requestFingerprint) {
        throw new ConflictException("La clave de operacion ya fue usada con otros datos");
      }
      if (!operation.created) {
        if (operation.record.status !== "COMPLETED" || !operation.record.payment_ids?.length) {
          throw new ConflictException("La operacion de pago esta incompleta y requiere revision");
        }
        const records = await this.repository.listByIds(
          operation.record.payment_ids,
          tenantId,
          client
        );
        const allocations = await this.repository.listAllocationsByPaymentIds(
          operation.record.payment_ids,
          client
        );
        responses = records.map((record) => this.mapPayment(record, allocations));
        await client.query("COMMIT");
        return responses;
      }
      await this.repository.lockDocument(client, tenantId, payload.referenceType, payload.referenceId);
      const document = await this.resolveReferenceDocument(tenantId, payload.referenceType, payload.referenceId, client);
      if (!document.party_id) throw new BadRequestException("El documento no tiene tercero asociado");
      if (!await this.repository.fitsDocumentBalance(client, tenantId, payload.referenceType,
        payload.referenceId, document, payload.payments.map((line) => line.amount))) {
        throw new BadRequestException("El pago excede el saldo actual del documento. Actualiza el documento.");
      }
      if (!payload.cashSessionId) throw new BadRequestException("Debes tener una caja abierta para registrar pagos");
      await this.repository.lockPaymentCashSession(client, tenantId, payload.cashSessionId);
      responses = [];
      for (const line of payload.payments) {
        const method = await this.paymentMethodsRepository.findById(line.paymentMethodId, tenantId, client);
        if (!method?.active) throw new BadRequestException("Metodo de pago invalido o inactivo");
        if (method.requires_reference && !line.referenceNumber?.trim()) {
          throw new BadRequestException("El metodo de pago requiere referencia");
        }
        responses.push(await this.createInternal({
          tenantId, branchId: payload.branchId, cashSessionId: payload.cashSessionId,
          referenceType: payload.referenceType, referenceId: payload.referenceId,
          direction: payload.referenceType === "PURCHASE" ? "OUT" : "IN", status: "COMPLETED",
          paymentMethodId: line.paymentMethodId, amount: line.amount,
          referenceNumber: line.referenceNumber, notes: line.notes,
          allocations: [{ referenceType: payload.referenceType, referenceId: payload.referenceId, allocatedAmount: line.amount }],
        }, actor, client, true));
      }
      await this.repository.completeDocumentPaymentOperation(
        client,
        tenantId,
        operationKey,
        responses.map((payment) => payment.id)
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    this.logCommittedDocumentPayments(actor, responses);
    return responses;
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
