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

  private async getDeliveryCashSummary(tenantId: string, cashSessionId: string) {
    if (!(await this.hasDeliveryCashSchema())) {
      return this.emptyDeliverySummary();
    }

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
      [tenantId, cashSessionId]
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

  private async getPaymentRows(tenantId: string, cashSessionId: string) {
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
        GROUP BY
          payment.payment_method_id,
          method.nombre,
          method.tipo,
          payment.reference_type,
          payment.direction
      `,
      [tenantId, cashSessionId]
    );

    return result.rows ?? [];
  }

  private async getManualMovementRows(tenantId: string, cashSessionId: string) {
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
        GROUP BY movement.movement_type, movement.direction
      `,
      [tenantId, cashSessionId]
    );

    return result.rows ?? [];
  }

  private async getDeliveryMethodRows(tenantId: string, cashSessionId: string) {
    if (!(await this.hasDeliveryCashSchema())) {
      return [] as DeliveryMethodBreakdownRow[];
    }

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
        GROUP BY delivery.payment_method_id, method.nombre, method.tipo
      `,
      [tenantId, cashSessionId]
    );

    return result.rows ?? [];
  }

  private async buildCashBreakdown(
    summary: CashSessionSummaryResponseDto,
    tenantId: string,
    cashSessionId: string
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

    const paymentRows = await this.getPaymentRows(tenantId, cashSessionId);
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

    const manualRows = await this.getManualMovementRows(tenantId, cashSessionId);
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

    const deliveryRows = await this.getDeliveryMethodRows(tenantId, cashSessionId);
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
    cashSessionId: string
  ): Promise<CashSessionSummaryResponseDto> {
    const deliverySummary = await this.getDeliveryCashSummary(
      tenantId,
      cashSessionId
    );
    const deliveryFees = this.normalizeExpectedAmount(
      deliverySummary.deliveredFeeTotal
    );
    const breakdown = await this.buildCashBreakdown(
      {
        ...summary,
        deliverySummary,
      },
      tenantId,
      cashSessionId
    );
    const auditRecords = (await this.hasCashCountAuditSchema())
      ? (
          await this.repository.listCashCounts(cashSessionId, tenantId, "AUDIT")
        ).map((record) => this.mapCashCountRecord(record))
      : [];

    return {
      ...summary,
      totals: {
        ...summary.totals,
        deliveryFees,
        expectedAmount: breakdown.cashControl.expectedCashAmount,
        netAmount: this.normalizeExpectedAmount(
          Number(summary.totals.netAmount ?? 0) + deliveryFees
        ),
      },
      paymentMethodDetails: breakdown.paymentMethodDetails,
      sourceBreakdown: breakdown.sourceBreakdown,
      cashControl: breakdown.cashControl,
      auditRecords,
      deliverySummary,
    };
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

  async getAuditPreview(
    cashSessionId: string,
    actor: FinanceActor
  ): Promise<CashSessionSummaryResponseDto> {
    const summary = await this.getSummary(cashSessionId, actor);
    if (summary.status !== "OPEN") {
      throw new BadRequestException("El arqueo preliminar requiere caja abierta");
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

    if (!this.canAdminCash(actor) && current.opened_by_user_id !== actor.userId) {
      throw new ForbiddenException("Solo puedes consultar tu propia caja");
    }

    if (!(await this.hasCashCountAuditSchema())) {
      return [];
    }

    return (
      await this.repository.listCashCounts(cashSessionId, tenantId, "AUDIT")
    ).map((record) => this.mapCashCountRecord(record));
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

    if (!this.canAdminCash(actor) && current.opened_by_user_id !== actor.userId) {
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
      cashSessionId
    );
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

    if (!this.canAdminCash(actor) && current.opened_by_user_id !== actor.userId) {
      throw new ForbiddenException("Solo puedes consultar tu propia caja");
    }

    const rawSummary = await this.repository.getSummary(cashSessionId, tenantId);
    if (!rawSummary) {
      throw new NotFoundException("No se pudo resumir la sesion de caja");
    }

    return this.withDeliverySummary(rawSummary, tenantId, cashSessionId);
  }
}
