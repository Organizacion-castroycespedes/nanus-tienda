import { Inject, Injectable } from "@nestjs/common";
import { FunctionRunnerService } from "../../database/function-runner.service";
import { DatabaseService } from "../../database/database.service";
import type {
  CashAuditListDataset,
  CashAuditTicketDataset,
  CashClosingListDataset,
  CashClosingTicketDataset,
  ReportActorContext,
} from "../types/cash-report.types";

type CashListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

type PaymentMethodCategory = "CASH" | "CARD" | "TRANSFER" | "DIGITAL" | "OTHER";

type PaymentMethodDetail = NonNullable<
  CashClosingTicketDataset["paymentMethodDetails"]
>[number];

type SourceBreakdown = NonNullable<CashClosingTicketDataset["sourceBreakdown"]>;

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
export class CashReportAdapter {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService,
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  private emptyDeliverySummary(): CashClosingTicketDataset["deliverySummary"] {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      excludedCount: 0,
      deliveredFeeTotal: 0,
      byPaymentMethod: [],
    };
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
  ): PaymentMethodCategory {
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
  ): PaymentMethodDetail {
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

  private emptySourceBreakdown(): SourceBreakdown {
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

  private addToPaymentDetail(
    detail: PaymentMethodDetail,
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
    sourceBreakdown: SourceBreakdown
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

  async getDeliveryClosingSummary(
    actor: ReportActorContext,
    cashSessionId: string
  ): Promise<CashClosingTicketDataset["deliverySummary"]> {
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
        count: string | number;
        total: string | number;
      }>;
    }>(
      `
        WITH session_scope AS (
          SELECT session.id, session.tenant_id, session.branch_id
          FROM public.cash_sessions AS session
          WHERE session.id = $1
            AND session.tenant_id = $2
            AND ($3::uuid IS NULL OR session.branch_id = $3::uuid)
          LIMIT 1
        ),
        delivery_scope AS (
          SELECT
            delivery.status,
            delivery.delivery_fee,
            delivery.payment_method_id,
            method.nombre AS payment_method_nombre
          FROM public.deliveries AS delivery
          INNER JOIN session_scope AS session
            ON session.id = delivery.cash_session_id
            AND session.tenant_id = delivery.tenant_id
          LEFT JOIN public.payment_methods AS method
            ON method.id = delivery.payment_method_id
            AND method.tenant_id = delivery.tenant_id
        ),
        payment_breakdown AS (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'paymentMethodId', item.payment_method_id,
                'paymentMethodNombre', item.payment_method_nombre,
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
              COUNT(*)::integer AS total_count,
              ROUND(SUM(delivery_fee), 2) AS total_amount
            FROM delivery_scope
            WHERE status IN ('ENTREGADO', 'DELIVERED')
              AND delivery_fee > 0
            GROUP BY payment_method_id, payment_method_nombre
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
      [cashSessionId, actor.tenantId, actor.branchId ?? null]
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
        count: Number(item.count ?? 0),
        total: Number(item.total ?? 0),
      })),
    };
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

  async getPaymentMethodClosingSummary(
    actor: ReportActorContext,
    cashSessionId: string
  ): Promise<Pick<
    CashClosingTicketDataset,
    "cashControl" | "sourceBreakdown" | "paymentMethodDetails" | "auditSummary"
  > | null> {
    const sessionResult = await this.db.query<{
      opening_amount: string | number;
    }>(
      `
        SELECT session.opening_amount
        FROM public.cash_sessions AS session
        WHERE session.id = $1
          AND session.tenant_id = $2
          AND ($3::uuid IS NULL OR session.branch_id = $3::uuid)
        LIMIT 1
      `,
      [cashSessionId, actor.tenantId, actor.branchId ?? null]
    );
    const session = sessionResult.rows[0];
    if (!session) {
      return null;
    }

    const sourceBreakdown = this.emptySourceBreakdown();
    sourceBreakdown.opening = this.roundAmount(session.opening_amount);
    const detailsByKey = new Map<string, PaymentMethodDetail>();
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

    const paymentResult = await this.db.query<PaymentBreakdownRow>(
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
      [actor.tenantId, cashSessionId]
    );

    paymentResult.rows.forEach((row) => {
      this.addToPaymentDetail(
        getDetail(
          row.payment_method_id,
          row.payment_method_nombre,
          row.payment_method_tipo
        ),
        this.paymentSource(row.reference_type, row.direction),
        this.roundAmount(row.total_amount),
        Number(row.item_count ?? 0),
        sourceBreakdown
      );
    });

    const movementResult = await this.db.query<ManualMovementBreakdownRow>(
      `
        SELECT
          movement.direction,
          COUNT(*)::integer AS item_count,
          ROUND(SUM(movement.amount), 2) AS total_amount
        FROM public.cash_movements AS movement
        WHERE movement.tenant_id = $1
          AND movement.cash_session_id = $2
          AND movement.movement_type NOT IN ('OPENING', 'CLOSING', 'PAYMENT')
        GROUP BY movement.direction
      `,
      [actor.tenantId, cashSessionId]
    );

    movementResult.rows.forEach((row) => {
      this.addToPaymentDetail(
        getDetail(null, "Efectivo", "CASH"),
        row.direction === "IN" ? "manualIn" : "manualOut",
        this.roundAmount(row.total_amount),
        Number(row.item_count ?? 0),
        sourceBreakdown
      );
    });

    if (await this.hasDeliveryCashSchema()) {
      const deliveryResult = await this.db.query<DeliveryMethodBreakdownRow>(
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
        [actor.tenantId, cashSessionId]
      );

      deliveryResult.rows.forEach((row) => {
        this.addToPaymentDetail(
          getDetail(
            row.payment_method_id,
            row.payment_method_nombre,
            row.payment_method_tipo
          ),
          "deliveries",
          this.roundAmount(row.total_amount),
          Number(row.item_count ?? 0),
          sourceBreakdown
        );
      });
    }

    const paymentMethodDetails = [...detailsByKey.values()].sort((left, right) => {
      if (left.isCash !== right.isCash) {
        return left.isCash ? -1 : 1;
      }
      return left.paymentMethodNombre.localeCompare(right.paymentMethodNombre);
    });

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
    const expectedCashAmount = this.roundAmount(
      Math.max(
        0,
        sourceBreakdown.opening +
          cashPaymentsIn +
          cashDeliveryFees +
          cashManualIn -
          cashPaymentsOut -
          cashManualOut
      )
    );
    const nonCashNet = this.roundAmount(
      paymentMethodDetails
        .filter((detail) => !detail.isCash)
        .reduce((sum, detail) => sum + detail.net, 0)
    );

    let auditSummary = { auditCount: 0, lastAuditAt: null as string | null };
    if (await this.hasCashCountAuditSchema()) {
      const auditResult = await this.db.query<{
        audit_count: string | number;
        last_audit_at: string | null;
      }>(
        `
          SELECT
            COUNT(*)::integer AS audit_count,
            MAX(counted_at) AS last_audit_at
          FROM public.cash_counts
          WHERE tenant_id = $1
            AND cash_session_id = $2
            AND count_type = 'AUDIT'
        `,
        [actor.tenantId, cashSessionId]
      );
      auditSummary = {
        auditCount: Number(auditResult.rows[0]?.audit_count ?? 0),
        lastAuditAt: auditResult.rows[0]?.last_audit_at ?? null,
      };
    }

    return {
      paymentMethodDetails,
      sourceBreakdown,
      cashControl: {
        openingCash: sourceBreakdown.opening,
        cashPaymentsIn,
        cashPaymentsOut,
        cashDeliveryFees,
        cashManualIn,
        cashManualOut,
        expectedCashAmount,
        countedCashAmount: null,
        differenceAmount: null,
        nonCashNet,
        totalNetAmount: sourceBreakdown.net,
      },
      auditSummary,
    };
  }

  async getCashClosingsList(
    actor: ReportActorContext,
    filters: CashListParams
  ): Promise<CashClosingListDataset | null> {
    return this.functionRunnerService.executeFunction<CashClosingListDataset | null>(
      "report_cash_closings",
      [
        actor.userId,
        actor.role,
        actor.tenantId,
        actor.branchId,
        filters.tenantId ?? null,
        filters.branchId ?? null,
        filters.dateFrom ?? null,
        filters.dateTo ?? null,
      ]
    );
  }

  async getCashClosingTicket(
    actor: ReportActorContext,
    cashSessionId: string
  ): Promise<CashClosingTicketDataset | null> {
    return this.functionRunnerService.executeFunction<CashClosingTicketDataset | null>(
      "report_cash_closing_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, cashSessionId]
    );
  }

  async getCashAuditList(
    actor: ReportActorContext,
    filters: CashListParams
  ): Promise<CashAuditListDataset | null> {
    return this.functionRunnerService.executeFunction<CashAuditListDataset | null>(
      "report_cash_audit",
      [
        actor.userId,
        actor.role,
        actor.tenantId,
        actor.branchId,
        filters.tenantId ?? null,
        filters.branchId ?? null,
        filters.dateFrom ?? null,
        filters.dateTo ?? null,
      ]
    );
  }

  async getCashAuditTicket(
    actor: ReportActorContext,
    cashCountId: string
  ): Promise<CashAuditTicketDataset | null> {
    return this.functionRunnerService.executeFunction<CashAuditTicketDataset | null>(
      "report_cash_audit_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, cashCountId]
    );
  }
}
