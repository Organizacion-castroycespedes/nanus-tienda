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
import { FinanceAccessRepository } from "../common/repositories/finance-access.repository";
import { CashMovementsRepository } from "../cash-movements/cash-movements.repository";
import { CashRegistersRepository } from "../cash-registers/cash-registers.repository";
import { CashSessionResponseDto } from "./dto/cash-session-response.dto";
import type {
  CashSessionAuditRecordDto,
  CashSessionCashControlDto,
  CashSessionPaymentCategoryDto,
  CashSessionPaymentMethodDetailDto,
  CashSessionSourceBreakdownDto,
  CashSessionSummaryResponseDto,
} from "./dto/cash-session-summary-response.dto";
import { CloseCashSessionDto } from "./dto/close-cash-session.dto";
import { CreateCashSessionAuditDto } from "./dto/create-cash-session-audit.dto";
import { CurrentCashSessionQueryDto } from "./dto/current-cash-session-query.dto";
import { ListCashSessionHistoryDto } from "./dto/list-cash-session-history.dto";
import { OpenCashSessionDto } from "./dto/open-cash-session.dto";
import {
  CashSessionsRepository,
  type CashCountRecord,
  type CashSessionRecord,
} from "./cash-sessions.repository";

type PaymentBreakdownRow = {
  payment_method_id: string | null;
  payment_method_nombre: string | null;
  payment_method_tipo: string | null;
  reference_type: string;
  direction: "IN" | "OUT";
  item_count: string | number;
  total_amount: string | number;
};

type ManualMovementBreakdownRow = {
  movement_type: string;
  direction: "IN" | "OUT";
  item_count: string | number;
  total_amount: string | number;
};

type DeliveryMethodBreakdownRow = {
  payment_method_id: string | null;
  payment_method_nombre: string | null;
  payment_method_tipo: string | null;
  item_count: string | number;
  total_amount: string | number;
};

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

  private async canOperateCashSession(
    actor: FinanceActor,
    session: { opened_by_user_id: string; cash_register_id: string }
  ) {
    if (this.canAdminCash(actor)) {
      return true;
    }
    if (session.opened_by_user_id === actor.userId) {
      return true;
    }
    return this.repository.hasActiveAssignment(
      session.cash_register_id,
      actor.userId
    );
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

  private roundAmount(value: number | string | null | undefined) {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) {
      return 0;
    }
    return Number(amount.toFixed(2));
  }

  private normalizePaymentCategory(
    paymentMethodTipo: string | null | undefined,
    paymentMethodNombre?: string | null
  ): CashSessionPaymentCategoryDto {
    const raw = `${paymentMethodTipo ?? ""} ${paymentMethodNombre ?? ""}`
      .trim()
      .toUpperCase();

    if (/\b(CASH|EFECTIVO)\b/.test(raw)) {
      return "CASH";
    }
    if (/\b(CARD|CREDIT|DEBIT|TARJETA|CREDITO|DEBITO)\b/.test(raw)) {
      return "CARD";
    }
    if (/\b(BANK|TRANSFER|TRANSFERENCIA|BANCO)\b/.test(raw)) {
      return "TRANSFER";
    }
    if (/\b(DIGITAL|WALLET|NEQUI|DAVIPLATA|BILLETERA)\b/.test(raw)) {
      return "DIGITAL";
    }
    return "OTHER";
  }

  private createPaymentMethodDetail(
    paymentMethodId: string | null,
    paymentMethodNombre: string | null,
    paymentMethodTipo: string | null
  ): CashSessionPaymentMethodDetailDto {
    const category = this.normalizePaymentCategory(
      paymentMethodTipo,
      paymentMethodNombre
    );

    return {
      paymentMethodId,
      paymentMethodNombre:
        paymentMethodNombre?.trim() ||
        (category === "CASH" ? "Efectivo" : "Sin metodo"),
      paymentMethodTipo,
      category,
      isCash: category === "CASH",
      count: 0,
      sales: 0,
      orders: 0,
      purchases: 0,
      refunds: 0,
      deliveries: 0,
      manualIn: 0,
      manualOut: 0,
      otherIn: 0,
      otherOut: 0,
      totalIn: 0,
      totalOut: 0,
      net: 0,
    };
  }

  private emptySourceBreakdown(): CashSessionSourceBreakdownDto {
    return {
      opening: 0,
      posSales: 0,
      orders: 0,
      purchases: 0,
      refunds: 0,
      deliveries: 0,
      manualIn: 0,
      manualOut: 0,
      otherIn: 0,
      otherOut: 0,
      totalIn: 0,
      totalOut: 0,
      net: 0,
    };
  }

  private paymentSource(referenceType: string, direction: "IN" | "OUT") {
    if (direction === "IN" && referenceType === "SALE") {
      return "sales" as const;
    }
    if (direction === "IN" && referenceType === "SALES_ORDER") {
      return "orders" as const;
    }
    if (
      direction === "OUT" &&
      (referenceType === "PURCHASE" || referenceType === "PURCHASE_ORDER")
    ) {
      return "purchases" as const;
    }
    if (direction === "OUT" && referenceType === "REFUND") {
      return "refunds" as const;
    }
    return direction === "IN" ? ("otherIn" as const) : ("otherOut" as const);
  }

  private addToPaymentDetail(
    detail: CashSessionPaymentMethodDetailDto,
    source:
      | "sales"
      | "orders"
      | "purchases"
      | "refunds"
      | "deliveries"
      | "manualIn"
      | "manualOut"
      | "otherIn"
      | "otherOut",
    amount: number,
    count: number,
    sourceBreakdown: CashSessionSourceBreakdownDto
  ) {
    detail.count += count;

    if (source === "sales") {
      detail.sales = this.roundAmount(detail.sales + amount);
      sourceBreakdown.posSales = this.roundAmount(sourceBreakdown.posSales + amount);
    } else if (source === "orders") {
      detail.orders = this.roundAmount(detail.orders + amount);
      sourceBreakdown.orders = this.roundAmount(sourceBreakdown.orders + amount);
    } else if (source === "purchases") {
      detail.purchases = this.roundAmount(detail.purchases + amount);
      sourceBreakdown.purchases = this.roundAmount(sourceBreakdown.purchases + amount);
    } else if (source === "refunds") {
      detail.refunds = this.roundAmount(detail.refunds + amount);
      sourceBreakdown.refunds = this.roundAmount(sourceBreakdown.refunds + amount);
    } else if (source === "deliveries") {
      detail.deliveries = this.roundAmount(detail.deliveries + amount);
      sourceBreakdown.deliveries = this.roundAmount(sourceBreakdown.deliveries + amount);
    } else if (source === "manualIn") {
      detail.manualIn = this.roundAmount(detail.manualIn + amount);
      sourceBreakdown.manualIn = this.roundAmount(sourceBreakdown.manualIn + amount);
    } else if (source === "manualOut") {
      detail.manualOut = this.roundAmount(detail.manualOut + amount);
      sourceBreakdown.manualOut = this.roundAmount(sourceBreakdown.manualOut + amount);
    } else if (source === "otherIn") {
      detail.otherIn = this.roundAmount(detail.otherIn + amount);
      sourceBreakdown.otherIn = this.roundAmount(sourceBreakdown.otherIn + amount);
    } else {
      detail.otherOut = this.roundAmount(detail.otherOut + amount);
      sourceBreakdown.otherOut = this.roundAmount(sourceBreakdown.otherOut + amount);
    }

    const isOut =
      source === "purchases" ||
      source === "refunds" ||
      source === "manualOut" ||
      source === "otherOut";

    if (isOut) {
      detail.totalOut = this.roundAmount(detail.totalOut + amount);
      sourceBreakdown.totalOut = this.roundAmount(sourceBreakdown.totalOut + amount);
    } else {
      detail.totalIn = this.roundAmount(detail.totalIn + amount);
      sourceBreakdown.totalIn = this.roundAmount(sourceBreakdown.totalIn + amount);
    }

    detail.net = this.roundAmount(detail.totalIn - detail.totalOut);
  }

  private emptyDeliverySummary() {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      excludedCount: 0,
      deliveredFeeTotal: 0,
      byPaymentMethod: [],
    };
  }

  private async hasDeliveryCashSchema() {
    const result = await this.db.query<{ has_schema: boolean }>(
      `
        SELECT (
          SELECT COUNT(*) = 5
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'deliveries'
            AND column_name IN (
              'cash_session_id',
              'cash_register_id',
              'terminal_id',
              'cash_impact_amount',
              'cash_impact_recorded_at'
            )
        ) AS has_schema
      `
    );

    return Boolean(result.rows[0]?.has_schema);
  }

  private async hasCashCountAuditSchema() {
    const result = await this.db.query<{ has_schema: boolean }>(
      `
        SELECT (
          SELECT COUNT(*) = 2
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'cash_counts'
            AND column_name IN ('count_type', 'breakdown_json')
        ) AS has_schema
      `
    );

    return Boolean(result.rows[0]?.has_schema);
  }

  private async getDeliveryCashSummary(
    tenantId: string,
    cashSessionId: string,
    operatorUserId?: string
  ) {
    if (!(await this.hasDeliveryCashSchema())) {
      return this.emptyDeliverySummary();
    }

    const params: unknown[] = [tenantId, cashSessionId];
    const operatorFilter = operatorUserId
      ? `AND d.created_by_user_id = $${params.push(operatorUserId)}`
      : "";

    const result = await this.db.query<{
      delivered_count: string | number;
      pending_count: string | number;
      excluded_count: string | number;
      delivered_fee_total: string | number;
      by_payment_method: Array<{
        paymentMethodId: string | null;
        paymentMethodNombre: string | null;
        paymentMethodTipo: string | null;
        count: number | string;
        total: number | string;
      }>;
    }>(
      `
        WITH delivery_scope AS (
          SELECT
            d.status,
            d.delivery_fee,
            d.payment_method_id,
            method.nombre AS payment_method_nombre,
            method.tipo AS payment_method_tipo
          FROM public.deliveries AS d
          LEFT JOIN public.payment_methods AS method
            ON method.id = d.payment_method_id
            AND method.tenant_id = d.tenant_id
          WHERE d.tenant_id = $1
            AND d.cash_session_id = $2
            ${operatorFilter}
        ),
        payment_breakdown AS (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'paymentMethodId', item.payment_method_id,
                'paymentMethodNombre', item.payment_method_nombre,
                'paymentMethodTipo', item.payment_method_tipo,
                'count', item.total_count,
                'total', item.total_amount
              )
              ORDER BY item.payment_method_nombre NULLS LAST
            ),
            '[]'::jsonb
          ) AS data
          FROM (
            SELECT
              payment_method_id,
              payment_method_nombre,
              payment_method_tipo,
              COUNT(*)::integer AS total_count,
              ROUND(SUM(delivery_fee), 2) AS total_amount
            FROM delivery_scope
            WHERE status IN ('ENTREGADO', 'DELIVERED')
              AND delivery_fee > 0
            GROUP BY payment_method_id, payment_method_nombre, payment_method_tipo
          ) AS item
        ),
        summary AS (
          SELECT
            COUNT(*) FILTER (
              WHERE status IN ('ENTREGADO', 'DELIVERED')
            ) AS delivered_count,
            COUNT(*) FILTER (
              WHERE status IN (
                'CREADO',
                'CREATED',
                'EN_PREPARACION',
                'ASSIGNED',
                'DESPACHADO',
                'DISPATCHED'
              )
            ) AS pending_count,
            COUNT(*) FILTER (
              WHERE status IN ('CANCELADO', 'CANCELLED', 'NO_ENTREGADO', 'NOT_DELIVERED')
            ) AS excluded_count,
            COALESCE(SUM(delivery_fee) FILTER (
              WHERE status IN ('ENTREGADO', 'DELIVERED')
            ), 0) AS delivered_fee_total
          FROM delivery_scope
        )
        SELECT
          summary.delivered_count,
          summary.pending_count,
          summary.excluded_count,
          summary.delivered_fee_total,
          payment_breakdown.data AS by_payment_method
        FROM summary
        CROSS JOIN payment_breakdown
      `,
      params
    );

    const row = result.rows[0];
    if (!row) {
      return this.emptyDeliverySummary();
    }

    return {
      deliveredCount: Number(row.delivered_count ?? 0),
      pendingCount: Number(row.pending_count ?? 0),
      excludedCount: Number(row.excluded_count ?? 0),
      deliveredFeeTotal: Number(row.delivered_fee_total ?? 0),
      byPaymentMethod: (row.by_payment_method ?? []).map((item) => ({
        paymentMethodId: item.paymentMethodId,
        paymentMethodNombre: item.paymentMethodNombre,
        paymentMethodTipo: item.paymentMethodTipo,
        count: Number(item.count ?? 0),
        total: Number(item.total ?? 0),
      })),
    };
  }

  private mapCashCountRecord(
    record: CashCountRecord
  ): CashSessionAuditRecordDto {
    return {
      id: record.id,
      countType: record.count_type,
      countedCashAmount: this.roundAmount(record.counted_cash_amount),
      expectedAmount: this.roundAmount(record.expected_amount),
      differenceAmount: this.roundAmount(record.difference_amount),
      notes: record.notes,
      countedByUserId: record.counted_by_user_id,
      countedByUserEmail: record.counted_by_user_email,
      countedAt: record.counted_at,
    };
  }

  private async getPaymentRows(
    tenantId: string,
    cashSessionId: string,
    operatorUserId?: string
  ) {
    const params: unknown[] = [tenantId, cashSessionId];
    // SALE: match Turno actual (sale.user_id). Other refs: payment.created_by.
    const operatorFilter = operatorUserId
      ? `AND (
          (
            payment.reference_type = 'SALE'
            AND EXISTS (
              SELECT 1
              FROM public.sales AS sale
              WHERE sale.tenant_id = payment.tenant_id
                AND sale.id = payment.reference_id
                AND sale.user_id = $${params.push(operatorUserId)}
            )
          )
          OR (
            payment.reference_type <> 'SALE'
            AND payment.created_by = $${params.length}
          )
        )`
      : "";
    const result = await this.db.query<PaymentBreakdownRow>(
      `
        SELECT
          payment.payment_method_id,
          method.nombre AS payment_method_nombre,
          method.tipo AS payment_method_tipo,
          payment.reference_type,
          payment.direction,
          COUNT(*)::integer AS item_count,
          ROUND(SUM(payment.amount), 2) AS total_amount
        FROM public.payments AS payment
        INNER JOIN public.payment_methods AS method
          ON method.id = payment.payment_method_id
         AND method.tenant_id = payment.tenant_id
        WHERE payment.tenant_id = $1
          AND payment.cash_session_id = $2
          AND payment.status IN ('PENDING', 'COMPLETED')
          ${operatorFilter}
        GROUP BY
          payment.payment_method_id,
          method.nombre,
          method.tipo,
          payment.reference_type,
          payment.direction
      `,
      params
    );

    return result.rows ?? [];
  }

  private async getManualMovementRows(
    tenantId: string,
    cashSessionId: string,
    operatorUserId?: string
  ) {
    const params: unknown[] = [tenantId, cashSessionId];
    const operatorFilter = operatorUserId
      ? `AND movement.created_by = $${params.push(operatorUserId)}`
      : "";
    const result = await this.db.query<ManualMovementBreakdownRow>(
      `
        SELECT
          movement.movement_type,
          movement.direction,
          COUNT(*)::integer AS item_count,
          ROUND(SUM(movement.amount), 2) AS total_amount
        FROM public.cash_movements AS movement
        WHERE movement.tenant_id = $1
          AND movement.cash_session_id = $2
          AND movement.movement_type NOT IN ('OPENING', 'CLOSING', 'PAYMENT')
          ${operatorFilter}
        GROUP BY movement.movement_type, movement.direction
      `,
      params
    );

    return result.rows ?? [];
  }

  private async getDeliveryMethodRows(
    tenantId: string,
    cashSessionId: string,
    operatorUserId?: string
  ) {
    if (!(await this.hasDeliveryCashSchema())) {
      return [] as DeliveryMethodBreakdownRow[];
    }

    const params: unknown[] = [tenantId, cashSessionId];
    const operatorFilter = operatorUserId
      ? `AND delivery.created_by_user_id = $${params.push(operatorUserId)}`
      : "";
    const result = await this.db.query<DeliveryMethodBreakdownRow>(
      `
        SELECT
          delivery.payment_method_id,
          method.nombre AS payment_method_nombre,
          method.tipo AS payment_method_tipo,
          COUNT(*)::integer AS item_count,
          ROUND(SUM(delivery.delivery_fee), 2) AS total_amount
        FROM public.deliveries AS delivery
        LEFT JOIN public.payment_methods AS method
          ON method.id = delivery.payment_method_id
         AND method.tenant_id = delivery.tenant_id
        WHERE delivery.tenant_id = $1
          AND delivery.cash_session_id = $2
          AND delivery.status IN ('ENTREGADO', 'DELIVERED')
          AND delivery.delivery_fee > 0
          ${operatorFilter}
        GROUP BY delivery.payment_method_id, method.nombre, method.tipo
      `,
      params
    );

    return result.rows ?? [];
  }

  private async buildCashBreakdown(
    summary: CashSessionSummaryResponseDto,
    tenantId: string,
    cashSessionId: string,
    operatorUserId?: string
  ) {
    const sourceBreakdown = this.emptySourceBreakdown();
    sourceBreakdown.opening = this.roundAmount(summary.totals.openingAmount);

    const detailsByKey = new Map<string, CashSessionPaymentMethodDetailDto>();
    const getDetail = (
      paymentMethodId: string | null,
      paymentMethodNombre: string | null,
      paymentMethodTipo: string | null
    ) => {
      const category = this.normalizePaymentCategory(
        paymentMethodTipo,
        paymentMethodNombre
      );
      const key = paymentMethodId ?? `__${category}_${paymentMethodNombre ?? "cash"}`;
      const existing = detailsByKey.get(key);
      if (existing) {
        return existing;
      }
      const created = this.createPaymentMethodDetail(
        paymentMethodId,
        paymentMethodNombre,
        paymentMethodTipo ?? category
      );
      detailsByKey.set(key, created);
      return created;
    };

    const paymentRows = await this.getPaymentRows(
      tenantId,
      cashSessionId,
      operatorUserId
    );
    paymentRows.forEach((row) => {
      const detail = getDetail(
        row.payment_method_id,
        row.payment_method_nombre,
        row.payment_method_tipo
      );
      this.addToPaymentDetail(
        detail,
        this.paymentSource(row.reference_type, row.direction),
        this.roundAmount(row.total_amount),
        Number(row.item_count ?? 0),
        sourceBreakdown
      );
    });

    const manualRows = await this.getManualMovementRows(
      tenantId,
      cashSessionId,
      operatorUserId
    );
    manualRows.forEach((row) => {
      const detail = getDetail(null, "Efectivo", "CASH");
      this.addToPaymentDetail(
        detail,
        row.direction === "IN" ? "manualIn" : "manualOut",
        this.roundAmount(row.total_amount),
        Number(row.item_count ?? 0),
        sourceBreakdown
      );
    });

    const deliveryRows = await this.getDeliveryMethodRows(
      tenantId,
      cashSessionId,
      operatorUserId
    );
    deliveryRows.forEach((row) => {
      const detail = getDetail(
        row.payment_method_id,
        row.payment_method_nombre,
        row.payment_method_tipo
      );
      this.addToPaymentDetail(
        detail,
        "deliveries",
        this.roundAmount(row.total_amount),
        Number(row.item_count ?? 0),
        sourceBreakdown
      );
    });

    const paymentMethodDetails = [...detailsByKey.values()].sort((left, right) => {
      if (left.isCash !== right.isCash) {
        return left.isCash ? -1 : 1;
      }
      return left.paymentMethodNombre.localeCompare(right.paymentMethodNombre);
    });

    sourceBreakdown.totalIn = this.roundAmount(sourceBreakdown.totalIn);
    sourceBreakdown.totalOut = this.roundAmount(sourceBreakdown.totalOut);
    sourceBreakdown.net = this.roundAmount(
      sourceBreakdown.opening +
        sourceBreakdown.totalIn -
        sourceBreakdown.totalOut
    );

    const cashDetails = paymentMethodDetails.filter((detail) => detail.isCash);
    const cashPaymentsIn = this.roundAmount(
      cashDetails.reduce(
        (sum, detail) => sum + detail.sales + detail.orders + detail.otherIn,
        0
      )
    );
    const cashPaymentsOut = this.roundAmount(
      cashDetails.reduce(
        (sum, detail) => sum + detail.purchases + detail.refunds + detail.otherOut,
        0
      )
    );
    const cashDeliveryFees = this.roundAmount(
      cashDetails.reduce((sum, detail) => sum + detail.deliveries, 0)
    );
    const cashManualIn = this.roundAmount(
      cashDetails.reduce((sum, detail) => sum + detail.manualIn, 0)
    );
    const cashManualOut = this.roundAmount(
      cashDetails.reduce((sum, detail) => sum + detail.manualOut, 0)
    );
    const expectedCashAmount = this.normalizeExpectedAmount(
      sourceBreakdown.opening +
        cashPaymentsIn +
        cashDeliveryFees +
        cashManualIn -
        cashPaymentsOut -
        cashManualOut
    );
    const countedCashAmount =
      summary.lastCount?.countedCashAmount === undefined ||
      summary.lastCount?.countedCashAmount === null
        ? null
        : this.roundAmount(summary.lastCount.countedCashAmount);
    const differenceAmount =
      countedCashAmount === null
        ? null
        : this.roundAmount(countedCashAmount - expectedCashAmount);

    const nonCashNet = this.roundAmount(
      paymentMethodDetails
        .filter((detail) => !detail.isCash)
        .reduce((sum, detail) => sum + detail.net, 0)
    );

    const cashControl: CashSessionCashControlDto = {
      openingCash: sourceBreakdown.opening,
      cashPaymentsIn,
      cashPaymentsOut,
      cashDeliveryFees,
      cashManualIn,
      cashManualOut,
      expectedCashAmount,
      countedCashAmount,
      differenceAmount,
      nonCashNet,
      totalNetAmount: sourceBreakdown.net,
    };

    return {
      paymentMethodDetails,
      sourceBreakdown,
      cashControl,
    };
  }

  private async withDeliverySummary(
    summary: CashSessionSummaryResponseDto,
    tenantId: string,
    cashSessionId: string,
    operatorUserId?: string
  ): Promise<CashSessionSummaryResponseDto> {
    const deliverySummary = await this.getDeliveryCashSummary(
      tenantId,
      cashSessionId,
      operatorUserId
    );
    const deliveryFees = this.normalizeExpectedAmount(
      deliverySummary.deliveredFeeTotal
    );
    const openingAmount = operatorUserId
      ? summary.openedByUserId === operatorUserId
        ? summary.totals.openingAmount
        : 0
      : summary.totals.openingAmount;

    const auditRecords = (await this.hasCashCountAuditSchema())
      ? (
          await this.repository.listCashCounts(cashSessionId, tenantId, "AUDIT")
        )
          .filter((record) => !operatorUserId || record.counted_by_user_id === operatorUserId)
          .map((record) => this.mapCashCountRecord(record))
      : [];
    const closureRecords = (await this.hasCashCountAuditSchema())
      ? (await this.repository.listCashCounts(cashSessionId, tenantId, "CLOSING"))
          .filter((record) => !operatorUserId || record.counted_by_user_id === operatorUserId)
          .map((record) => this.mapCashCountRecord(record))
      : [];
    const lastCount = operatorUserId
      ? auditRecords[0]
        ? {
            id: auditRecords[0].id,
            countType: auditRecords[0].countType,
            countedCashAmount: auditRecords[0].countedCashAmount,
            expectedAmount: auditRecords[0].expectedAmount,
            differenceAmount: auditRecords[0].differenceAmount,
            notes: auditRecords[0].notes,
            countedByUserId: auditRecords[0].countedByUserId,
            countedByUserEmail: auditRecords[0].countedByUserEmail,
            countedAt: auditRecords[0].countedAt,
          }
        : null
      : summary.lastCount;

    const breakdown = await this.buildCashBreakdown(
      {
        ...summary,
        lastCount,
        totals: {
          ...summary.totals,
          openingAmount,
          deliveryFees,
        },
        deliverySummary,
      },
      tenantId,
      cashSessionId,
      operatorUserId
    );
    const closureProgress = await this.getClosureProgress(
      cashSessionId,
      await this.repository.findById(cashSessionId, tenantId) as CashSessionRecord,
      tenantId
    );

    const source = breakdown.sourceBreakdown;
    const scopedTotals = operatorUserId
      ? {
          openingAmount,
          paymentsIn: this.roundAmount(
            source.posSales + source.orders + source.otherIn
          ),
          paymentsOut: this.roundAmount(
            source.purchases + source.refunds + source.otherOut
          ),
          expenses: 0,
          withdrawals: 0,
          adjustmentsIn: source.manualIn,
          adjustmentsOut: source.manualOut,
          closingRecorded: closureRecords.reduce(
            (sum, record) => sum + record.countedCashAmount,
            0
          ),
          salesPayments: source.posSales,
          purchasePayments: source.purchases,
          refundPayments: source.refunds,
          deliveryFees: source.deliveries,
          expectedAmount: breakdown.cashControl.expectedCashAmount,
          netAmount: source.net,
          movementCount: breakdown.paymentMethodDetails.reduce(
            (total, detail) => total + detail.count,
            0
          ),
          paymentCount: breakdown.paymentMethodDetails.reduce(
            (total, detail) => total + detail.count,
            0
          ),
        }
      : {
          ...summary.totals,
          deliveryFees,
          expectedAmount: breakdown.cashControl.expectedCashAmount,
          netAmount: this.normalizeExpectedAmount(
            Number(summary.totals.netAmount ?? 0) + deliveryFees
          ),
        };

    return {
      ...summary,
      totals: scopedTotals,
      paymentBreakdown: operatorUserId
        ? breakdown.paymentMethodDetails.map((detail) => ({
            paymentMethodId: detail.paymentMethodId ?? "",
            paymentMethodNombre: detail.paymentMethodNombre,
            paymentMethodTipo: detail.paymentMethodTipo ?? detail.category,
            direction: "IN" as const,
            count: detail.count,
            total: detail.totalIn,
          }))
        : summary.paymentBreakdown,
      movementBreakdown: operatorUserId ? [] : summary.movementBreakdown,
      recentMovements: operatorUserId
        ? summary.recentMovements.filter(
            (movement) => movement.createdBy === operatorUserId
          )
        : summary.recentMovements,
      lastCount,
      paymentMethodDetails: breakdown.paymentMethodDetails,
      sourceBreakdown: breakdown.sourceBreakdown,
      cashControl: breakdown.cashControl,
      auditRecords,
      closureRecords,
      closureProgress: operatorUserId
        ? {
            requiredUserIds: [operatorUserId],
            completedUserIds: closureRecords.some(
              (record) => record.countedByUserId === operatorUserId
            )
              ? [operatorUserId]
              : [],
            pendingUserIds: closureRecords.some(
              (record) => record.countedByUserId === operatorUserId
            )
              ? []
              : [operatorUserId],
            requiredCount: 1,
            completedCount: closureRecords.some(
              (record) => record.countedByUserId === operatorUserId
            )
              ? 1
              : 0,
            isComplete: closureRecords.some(
              (record) => record.countedByUserId === operatorUserId
            ),
          }
        : {
            requiredUserIds: closureProgress.requiredUserIds,
            completedUserIds: closureProgress.completedUserIds,
            pendingUserIds: closureProgress.pendingUserIds,
            requiredCount: closureProgress.requiredCount,
            completedCount: closureProgress.completedCount,
            isComplete: closureProgress.isComplete,
          },
      deliverySummary,
    };
  }

  private resolveRequiredCloserUserIds(
    openedByUserId: string,
    assignedUserIds: string[]
  ) {
    // Multi-cashier: only active assignees must deliver closing. Do NOT require the
    // opener when they only opened the caja and are not assigned (admin/super opener).
    if (assignedUserIds.length > 0) {
      return [...new Set(assignedUserIds)];
    }
    return [openedByUserId];
  }

  private async getClosureProgress(
    cashSessionId: string,
    current: CashSessionRecord,
    tenantId: string,
    client?: PoolClient
  ) {
    const assignedUserIds = await this.repository.listActiveAssignmentUserIds(
      current.cash_register_id,
      client
    );
    const requiredUserIds = this.resolveRequiredCloserUserIds(
      current.opened_by_user_id,
      assignedUserIds
    );
    const closingCounts = await this.repository.listCashCounts(
      cashSessionId,
      tenantId,
      "CLOSING",
      client
    );
    const completedUserIds = [...new Set(
      closingCounts
        .map((count) => count.counted_by_user_id)
        .filter((userId) => requiredUserIds.includes(userId))
    )];
    const pendingUserIds = requiredUserIds.filter(
      (userId) => !completedUserIds.includes(userId)
    );

    return {
      requiredUserIds,
      completedUserIds,
      pendingUserIds,
      requiredCount: requiredUserIds.length,
      completedCount: completedUserIds.length,
      isComplete: pendingUserIds.length === 0,
      closingCounts,
    };
  }

  private async finalizeOpenSessionFromProgress(
    client: PoolClient,
    current: CashSessionRecord,
    cashSessionId: string,
    tenantId: string,
    closedByUserId: string,
    progress: Awaited<ReturnType<CashSessionsService["getClosureProgress"]>>
  ) {
    const totalClosingAmount = progress.closingCounts
      .filter((item) => progress.requiredUserIds.includes(item.counted_by_user_id))
      .reduce((total, item) => total + Number(item.counted_cash_amount), 0);
    const totalExpectedAmount = progress.closingCounts
      .filter((item) => progress.requiredUserIds.includes(item.counted_by_user_id))
      .reduce((total, item) => total + Number(item.expected_amount), 0);
    const totalDifferenceAmount = Number(
      (totalClosingAmount - totalExpectedAmount).toFixed(2)
    );
    const closedAt = new Date().toISOString();
    const updated = await this.repository.close(client, cashSessionId, {
      closedByUserId,
      closedAt,
      closingAmount: Number(totalClosingAmount.toFixed(2)),
      expectedAmount: Number(totalExpectedAmount.toFixed(2)),
      differenceAmount: totalDifferenceAmount,
      status: "CLOSED",
    });
    if (!updated) {
      throw new NotFoundException("Sesion de caja no encontrada");
    }
    if (totalClosingAmount > 0) {
      await this.cashMovementsRepository.create(client, {
        tenantId,
        branchId: current.branch_id,
        cashSessionId,
        movementType: "CLOSING",
        direction: "OUT",
        amount: Number(totalClosingAmount.toFixed(2)),
        description: "Cierre completo de caja",
        createdBy: closedByUserId,
      });
    }
    return updated;
  }

  /** Recover sessions stuck OPEN after all required cashiers already delivered close. */
  private async reconcileCompleteOpenSession(
    current: CashSessionRecord,
    actorUserId: string
  ): Promise<CashSessionRecord> {
    if (current.status !== "OPEN") {
      return current;
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        current.id,
      ]);
      const locked = await this.repository.findById(
        current.id,
        current.tenant_id,
        client
      );
      if (!locked || locked.status !== "OPEN") {
        await client.query("COMMIT");
        return locked ?? current;
      }

      const progress = await this.getClosureProgress(
        locked.id,
        locked,
        locked.tenant_id,
        client
      );
      if (!progress.isComplete) {
        await client.query("COMMIT");
        return locked;
      }

      const updated = await this.finalizeOpenSessionFromProgress(
        client,
        locked,
        locked.id,
        locked.tenant_id,
        actorUserId,
        progress
      );
      await client.query("COMMIT");
      this.auditService.logEvent({
        tenantId: locked.tenant_id,
        userId: actorUserId,
        module: "finance",
        entity: "cash_sessions",
        entityId: updated.id,
        action: "CASH_SESSION_RECONCILED_AFTER_ALL_CASHIERS",
        before: this.mapResponse(locked),
        after: this.mapResponse(updated),
      });
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
      if (!(await this.canOperateCashSession(actor, existingOpen))) {
        throw new BadRequestException(
          "La caja ya tiene una sesion abierta y no tienes asignacion activa"
        );
      }
      return this.mapResponse(existingOpen);
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

    const isAdministrativeClose = this.canAdminCash(actor);
    if (!isAdministrativeClose && !(await this.canOperateCashSession(actor, current))) {
      throw new ForbiddenException("No tienes asignacion activa para esta caja");
    }

    if (!isAdministrativeClose) {
      const operatorSummary = await this.withDeliverySummary(
        await this.repository.getSummary(cashSessionId, tenantId) as CashSessionSummaryResponseDto,
        tenantId,
        cashSessionId,
        actor.userId
      );
      const expectedAmount = this.normalizeExpectedAmount(
        operatorSummary.cashControl.expectedCashAmount
      );
      const differenceAmount = Number(
        (payload.closingAmount - expectedAmount).toFixed(2)
      );
      const countedAt = new Date().toISOString();
      const client = await this.db.getClient();
      try {
        await client.query("BEGIN");
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext($1))",
          [cashSessionId]
        );
        const progressBefore = await this.getClosureProgress(
          cashSessionId,
          current,
          tenantId,
          client
        );
        const existingCount = progressBefore.closingCounts.find(
          (count) => count.counted_by_user_id === actor.userId
        );
        if (existingCount) {
          throw new BadRequestException(
            "Ya entregaste tu cierre para esta caja"
          );
        }
        const count = await this.repository.createCashCount(client, {
          tenantId,
          branchId: current.branch_id,
          cashSessionId,
          countedByUserId: actor.userId,
          countedAt,
          countedCashAmount: payload.closingAmount,
          expectedAmount,
          differenceAmount,
          notes: payload.description?.trim() || null,
          countType: "CLOSING",
          breakdownJson: {
            cashControl: operatorSummary.cashControl,
            sourceBreakdown: operatorSummary.sourceBreakdown,
            paymentMethodDetails: operatorSummary.paymentMethodDetails,
            deliverySummary: operatorSummary.deliverySummary,
          },
        });
        const progress = await this.getClosureProgress(
          cashSessionId,
          current,
          tenantId,
          client
        );

        if (!progress.isComplete) {
          await client.query("COMMIT");
          this.auditService.logEvent({
            tenantId,
            userId: actor.userId,
            module: "finance",
            entity: "cash_counts",
            entityId: count?.id ?? cashSessionId,
            action: "CASHIER_CLOSING_DELIVERED",
            after: count ? this.mapCashCountRecord(count) : null,
          });
          return {
            ...this.mapResponse(current),
            closureProgress: {
              requiredUserIds: progress.requiredUserIds,
              completedUserIds: progress.completedUserIds,
              pendingUserIds: progress.pendingUserIds,
              requiredCount: progress.requiredCount,
              completedCount: progress.completedCount,
              isComplete: false,
            },
            closureCount: count ? this.mapCashCountRecord(count) : null,
          };
        }

        const updated = await this.finalizeOpenSessionFromProgress(
          client,
          current,
          cashSessionId,
          tenantId,
          actor.userId,
          progress
        );
        await client.query("COMMIT");
        this.auditService.logEvent({
          tenantId,
          userId: actor.userId,
          module: "finance",
          entity: "cash_sessions",
          entityId: updated.id,
          action: "CASH_SESSION_CLOSED_AFTER_ALL_CASHIERS",
          before: this.mapResponse(current),
          after: this.mapResponse(updated),
        });
        return {
          ...this.mapResponse(updated),
          closureProgress: {
            requiredUserIds: progress.requiredUserIds,
            completedUserIds: progress.completedUserIds,
            pendingUserIds: [],
            requiredCount: progress.requiredCount,
            completedCount: progress.completedCount,
            isComplete: true,
          },
          closureCount: count ? this.mapCashCountRecord(count) : null,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    const rawSummary = await this.repository.getSummary(cashSessionId, tenantId);
    if (!rawSummary) {
      throw new NotFoundException("No se pudo resumir la sesion de caja");
    }
    const summary = await this.withDeliverySummary(
      rawSummary,
      tenantId,
      cashSessionId
    );

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
      countType: "CLOSING",
      breakdownJson: {
        cashControl: summary.cashControl,
        sourceBreakdown: summary.sourceBreakdown,
        paymentMethodDetails: summary.paymentMethodDetails,
        deliverySummary: summary.deliverySummary,
      },
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
      if (!(await this.canOperateCashSession(actor, current))) {
        throw new ForbiddenException("No autorizado para esta caja");
      }
      const reconciled = await this.reconcileCompleteOpenSession(
        current,
        actor.userId
      );
      if (reconciled.status !== "OPEN") {
        return null;
      }
      return this.mapResponse(reconciled);
    }

    // Never exclude completed closures here: POS and context selection need the
    // OPEN session while it remains open (even after USER delivered their close).
    let current = await this.repository.findCurrentByUser(
      actor.userId,
      tenantId,
      undefined,
      false
    );

    if (!current && this.canAdminCash(actor)) {
      const allowedBranchIds = await this.resolveAllowedBranchIds(
        actor,
        tenantId
      );
      if (allowedBranchIds && allowedBranchIds.length > 0) {
        for (const branchId of allowedBranchIds) {
          current = await this.repository.findOpenByBranch(branchId, tenantId);
          if (current) break;
        }
      } else if (this.canManageTenant(actor)) {
        const openSessions = await this.repository.listHistory({
          tenantId,
          status: "OPEN",
          limit: 1,
          offset: 0,
        });
        if (openSessions.length > 0) {
          current = openSessions[0];
        }
      }
    }

    if (!current) {
      return null;
    }

    const reconciled = await this.reconcileCompleteOpenSession(
      current,
      actor.userId
    );
    if (reconciled.status !== "OPEN") {
      return null;
    }

    return this.mapResponse(reconciled);
  }

  async getHistory(query: ListCashSessionHistoryDto, actor: FinanceActor) {
    if (!this.canOpenCash(actor)) {
      throw new ForbiddenException("No autorizado");
    }

    const tenantId = this.resolveTenantId(actor, query.tenantId);
    const requestedStatus = query.status;
    if (Boolean(query.dateFrom) !== Boolean(query.dateTo)) {
      throw new BadRequestException("Fecha desde y fecha hasta deben enviarse juntas");
    }
    if (requestedStatus !== "OPEN" && (!query.dateFrom || !query.dateTo)) {
      throw new BadRequestException(
        "Fecha desde y fecha hasta son obligatorias para sesiones históricas"
      );
    }
    if (query.dateFrom && query.dateTo) {
      const from = new Date(`${query.dateFrom}T00:00:00Z`);
      const to = new Date(`${query.dateTo}T00:00:00Z`);
      const days = (to.getTime() - from.getTime()) / 86400000;
      if (!Number.isFinite(days) || days < 0) {
        throw new BadRequestException("El rango de fechas es invalido");
      }
      if (days > 30) {
        throw new BadRequestException("El rango maximo es de 31 dias");
      }
    }
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
      openedByUserId: this.canAdminCash(actor) ? query.openedByUserId : undefined,
      operatorUserId: this.canAdminCash(actor) ? undefined : actor.userId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    });

    return records.map((record) => this.mapResponse(record));
  }

  async getAuditPreview(
    cashSessionId: string,
    actor: FinanceActor
  ): Promise<CashSessionSummaryResponseDto> {
    const summary = await this.getSummary(cashSessionId, actor);
    if (summary.status !== "OPEN") {
      throw new BadRequestException("El arqueo preliminar requiere caja abierta");
    }
    if (summary.closureProgress.completedUserIds.includes(actor.userId)) {
      throw new BadRequestException(
        "Ya entregaste tu cierre. No puedes registrar otro arqueo"
      );
    }
    return summary;
  }

  async listAudits(cashSessionId: string, actor: FinanceActor) {
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

    if (!(await this.canOperateCashSession(actor, current))) {
      throw new ForbiddenException("Solo puedes consultar tu propia caja");
    }

    if (!(await this.hasCashCountAuditSchema())) {
      return [];
    }

    return (await this.repository.listCashCounts(cashSessionId, tenantId, "AUDIT"))
      .filter((record) => this.canAdminCash(actor) || record.counted_by_user_id === actor.userId)
      .map((record) => this.mapCashCountRecord(record));
  }

  async createAudit(
    cashSessionId: string,
    payload: CreateCashSessionAuditDto,
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
      throw new BadRequestException("El arqueo preliminar requiere caja abierta");
    }

    await this.assertActiveUser(actor, tenantId);
    await this.assertBranchScope(actor, tenantId, current.branch_id);

    if (!(await this.canOperateCashSession(actor, current))) {
      throw new ForbiddenException("Solo puedes arquear tu propia caja");
    }
    if (!(await this.hasCashCountAuditSchema())) {
      throw new BadRequestException("Migracion V068 de arqueos no aplicada");
    }

    const rawSummary = await this.repository.getSummary(cashSessionId, tenantId);
    if (!rawSummary) {
      throw new NotFoundException("No se pudo resumir la sesion de caja");
    }
    const summary = await this.withDeliverySummary(
      rawSummary,
      tenantId,
      cashSessionId,
      this.canAdminCash(actor) ? undefined : actor.userId
    );
    if (summary.closureProgress.completedUserIds.includes(actor.userId)) {
      throw new BadRequestException(
        "Ya entregaste tu cierre. No puedes registrar otro arqueo"
      );
    }
    const expectedAmount = this.normalizeExpectedAmount(
      summary.cashControl.expectedCashAmount
    );
    const countedCashAmount = this.normalizeExpectedAmount(payload.countedCashAmount);
    const differenceAmount = this.roundAmount(countedCashAmount - expectedAmount);
    const countedAt = new Date().toISOString();

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const created = await this.repository.createCashCount(client, {
        tenantId,
        branchId: current.branch_id,
        cashSessionId,
        countedByUserId: actor.userId,
        countedAt,
        countedCashAmount,
        expectedAmount,
        differenceAmount,
        notes: payload.notes?.trim() || null,
        countType: "AUDIT",
        breakdownJson: {
          cashControl: summary.cashControl,
          sourceBreakdown: summary.sourceBreakdown,
          paymentMethodDetails: summary.paymentMethodDetails,
          deliverySummary: summary.deliverySummary,
        },
      });
      await client.query("COMMIT");

      this.auditService.logEvent({
        tenantId,
        userId: actor.userId,
        module: "finance",
        entity: "cash_counts",
        entityId: created?.id ?? cashSessionId,
        action: "CASH_SESSION_AUDIT_CREATED",
        after: created ? this.mapCashCountRecord(created) : null,
      });

      return created
        ? this.mapCashCountRecord(created)
        : {
            id: "",
            countType: "AUDIT" as const,
            countedCashAmount,
            expectedAmount,
            differenceAmount,
            notes: payload.notes?.trim() || null,
            countedByUserId: actor.userId,
            countedByUserEmail: null,
            countedAt,
          };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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

    if (!(await this.canOperateCashSession(actor, current))) {
      throw new ForbiddenException("Solo puedes consultar tu propia caja");
    }

    const reconciled = await this.reconcileCompleteOpenSession(
      current,
      actor.userId
    );

    const rawSummary = await this.repository.getSummary(reconciled.id, tenantId);
    if (!rawSummary) {
      throw new NotFoundException("No se pudo resumir la sesion de caja");
    }

    return this.withDeliverySummary(
      rawSummary,
      tenantId,
      reconciled.id,
      this.canAdminCash(actor) ? undefined : actor.userId
    );
  }
}
