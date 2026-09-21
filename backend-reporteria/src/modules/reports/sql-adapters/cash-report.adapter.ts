import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { FunctionRunnerService } from "../../database/function-runner.service";
import { DatabaseService } from "../../database/database.service";
import type {
  CashAuditListDataset,
  CashAuditTicketDataset,
  CashClosingListDataset,
  CashClosingTicketDataset,
  CashClosingListRow,
  CashAuditListRow,
  ReportActorContext,
} from "../types/cash-report.types";
import type { PrintableCompanyHeader } from "../types/sales-report.types";

type CashListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type CashExportFilters = CashListParams;

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

  private exportScopeParams(actor: ReportActorContext, filters: CashExportFilters) {
    return [
      actor.userId,
      actor.role,
      actor.tenantId,
      actor.branchId,
      filters.tenantId ?? null,
      filters.branchId ?? null,
      filters.dateFrom ?? null,
      filters.dateTo ?? null,
    ];
  }

  async getCashClosingsExportCount(
    actor: ReportActorContext,
    filters: CashExportFilters,
    client: PoolClient,
  ): Promise<number> {
    const result = await client.query<{ count: string }>(
      `WITH resolved AS (
         SELECT (scope->>'tenantId')::uuid AS tenant_id,
                NULLIF(scope->>'branchId', '')::uuid AS branch_id,
                COALESCE((scope->>'restrictToUser')::boolean, FALSE) AS restrict_to_user
           FROM public.report_resolve_pos_scope(
             $2::text, $3::uuid, $4::uuid, $5::uuid, $6::uuid
           ) AS scope
       )
       SELECT COUNT(*)::text AS count
       FROM public.cash_sessions AS session
       INNER JOIN public.tenants AS tenant ON tenant.id = session.tenant_id
       CROSS JOIN resolved
       WHERE session.tenant_id = resolved.tenant_id
         AND (resolved.branch_id IS NULL OR session.branch_id = resolved.branch_id)
         AND ($7::timestamptz IS NULL OR COALESCE(session.closed_at, session.opened_at) >= $7::timestamptz)
         AND ($8::timestamptz IS NULL OR COALESCE(session.closed_at, session.opened_at) < $8::timestamptz)
         AND (
           NOT resolved.restrict_to_user
           OR session.opened_by_user_id = $1::uuid
           OR session.closed_by_user_id = $1::uuid
         )`,
      this.exportScopeParams(actor, filters),
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async getCashClosingsExportBatch(
    actor: ReportActorContext,
    filters: CashExportFilters,
    client: PoolClient,
    offset: number,
    limit: number,
  ): Promise<CashClosingListRow[]> {
    const result = await client.query<CashClosingListRow>(
      `WITH resolved AS (
         SELECT (scope->>'tenantId')::uuid AS tenant_id,
                NULLIF(scope->>'branchId', '')::uuid AS branch_id,
                COALESCE((scope->>'restrictToUser')::boolean, FALSE) AS restrict_to_user
           FROM public.report_resolve_pos_scope(
             $2::text, $3::uuid, $4::uuid, $5::uuid, $6::uuid
           ) AS scope
       ), session_scope AS (
         SELECT session.id, session.tenant_id, session.branch_id,
                session.cash_register_id, session.opened_by_user_id,
                session.closed_by_user_id, session.opened_at, session.closed_at,
                session.opening_amount, session.closing_amount,
                session.expected_amount, session.difference_amount, session.status,
                tenant.nombre AS tenant_name, branch.nombre AS branch_name,
                register.codigo AS cash_register_code,
                register.nombre AS cash_register_name,
                terminal.name AS terminal_name,
                opened_user.email AS opened_by_email,
                closed_user.email AS closed_by_email,
                public.finance_cash_session_summary(session.tenant_id, session.id) AS summary
           FROM public.cash_sessions AS session
           CROSS JOIN resolved
           INNER JOIN public.tenants AS tenant ON tenant.id = session.tenant_id
           LEFT JOIN public.tenant_branches AS branch
             ON branch.id = session.branch_id AND branch.tenant_id = session.tenant_id
           LEFT JOIN public.cash_registers AS register
             ON register.id = session.cash_register_id AND register.tenant_id = session.tenant_id
           LEFT JOIN public.terminals AS terminal
             ON terminal.id = register.terminal_id AND terminal.tenant_id = register.tenant_id
           LEFT JOIN public.users AS opened_user
             ON opened_user.id = session.opened_by_user_id AND opened_user.tenant_id = session.tenant_id
           LEFT JOIN public.users AS closed_user
             ON closed_user.id = session.closed_by_user_id AND closed_user.tenant_id = session.tenant_id
          WHERE session.tenant_id = resolved.tenant_id
            AND (resolved.branch_id IS NULL OR session.branch_id = resolved.branch_id)
            AND ($7::timestamptz IS NULL OR COALESCE(session.closed_at, session.opened_at) >= $7::timestamptz)
            AND ($8::timestamptz IS NULL OR COALESCE(session.closed_at, session.opened_at) < $8::timestamptz)
            AND (
              NOT resolved.restrict_to_user
              OR session.opened_by_user_id = $1::uuid
              OR session.closed_by_user_id = $1::uuid
            )
       )
       SELECT session.id AS "cashSessionId", session.opened_at AS "openedAt",
              session.closed_at AS "closedAt", session.status,
              session.tenant_name AS "tenantName", session.branch_id AS "branchId",
              session.branch_name AS "branchName", session.cash_register_name AS "cashRegister",
              session.cash_register_code AS "cashRegisterCode", session.terminal_name AS terminal,
              session.opened_by_email AS "openedBy", session.closed_by_email AS "closedBy",
              COALESCE((session.summary->'totals'->>'openingAmount')::numeric, session.opening_amount, 0)::numeric AS "openingAmount",
              (
                COALESCE((session.summary->'totals'->>'salesPayments')::numeric, 0)
                + COALESCE((SELECT SUM(payment.amount) FROM public.payments AS payment
                   WHERE payment.tenant_id = session.tenant_id AND payment.cash_session_id = session.id
                     AND payment.status IN ('PENDING', 'COMPLETED') AND payment.direction = 'IN'
                     AND payment.reference_type = 'SALES_ORDER'), 0)
              )::numeric AS "totalIn",
              (
                COALESCE((session.summary->'totals'->>'refundPayments')::numeric, 0)
                + COALESCE((session.summary->'totals'->>'purchasePayments')::numeric, 0)
                + COALESCE((session.summary->'totals'->>'expenses')::numeric, 0)
                + COALESCE((session.summary->'totals'->>'withdrawals')::numeric, 0)
                + COALESCE((session.summary->'totals'->>'adjustmentsOut')::numeric, 0)
              )::numeric AS "totalOut",
              COALESCE((session.summary->'totals'->>'expectedAmount')::numeric, session.expected_amount, 0)::numeric AS "expectedAmount",
              COALESCE(session.closing_amount, (session.summary->'lastCount'->>'countedCashAmount')::numeric, 0)::numeric AS "closingAmount",
              COALESCE(
                session.difference_amount,
                (session.summary->'lastCount'->>'differenceAmount')::numeric,
                COALESCE(session.closing_amount, (session.summary->'lastCount'->>'countedCashAmount')::numeric, 0)
                  - COALESCE((session.summary->'totals'->>'expectedAmount')::numeric, session.expected_amount, 0)
              )::numeric AS difference
         FROM session_scope AS session
        ORDER BY session.opened_at DESC, session.id DESC
        LIMIT $9::integer OFFSET $10::integer`,
      [...this.exportScopeParams(actor, filters), limit, offset],
    );
    return result.rows.map((row) => ({
      ...row,
      openingAmount: Number(row.openingAmount),
      totalIn: Number(row.totalIn),
      totalOut: Number(row.totalOut),
      expectedAmount: Number(row.expectedAmount),
      closingAmount: Number(row.closingAmount),
      difference: Number(row.difference),
    }));
  }

  async getCashAuditsExportCount(
    actor: ReportActorContext,
    filters: CashExportFilters,
    client: PoolClient,
  ): Promise<number> {
    const result = await client.query<{ count: string }>(
      `WITH resolved AS (
         SELECT (scope->>'tenantId')::uuid AS tenant_id,
                NULLIF(scope->>'branchId', '')::uuid AS branch_id,
                COALESCE((scope->>'restrictToUser')::boolean, FALSE) AS restrict_to_user
           FROM public.report_resolve_pos_scope(
             $2::text, $3::uuid, $4::uuid, $5::uuid, $6::uuid
           ) AS scope
       )
       SELECT COUNT(*)::text AS count
       FROM public.cash_counts AS count_data
       INNER JOIN public.cash_sessions AS session
         ON session.id = count_data.cash_session_id AND session.tenant_id = count_data.tenant_id
       CROSS JOIN resolved
       WHERE count_data.tenant_id = resolved.tenant_id
         AND (resolved.branch_id IS NULL OR count_data.branch_id = resolved.branch_id)
         AND ($7::timestamptz IS NULL OR count_data.counted_at >= $7::timestamptz)
         AND ($8::timestamptz IS NULL OR count_data.counted_at < $8::timestamptz)
         AND (
           NOT resolved.restrict_to_user
           OR count_data.counted_by_user_id = $1::uuid
           OR session.opened_by_user_id = $1::uuid
         )`,
      this.exportScopeParams(actor, filters),
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async getCashAuditsExportBatch(
    actor: ReportActorContext,
    filters: CashExportFilters,
    client: PoolClient,
    offset: number,
    limit: number,
  ): Promise<CashAuditListRow[]> {
    const result = await client.query<CashAuditListRow>(
      `WITH resolved AS (
         SELECT (scope->>'tenantId')::uuid AS tenant_id,
                NULLIF(scope->>'branchId', '')::uuid AS branch_id,
                COALESCE((scope->>'restrictToUser')::boolean, FALSE) AS restrict_to_user
           FROM public.report_resolve_pos_scope(
             $2::text, $3::uuid, $4::uuid, $5::uuid, $6::uuid
           ) AS scope
       )
       SELECT count_data.id AS "cashCountId", count_data.cash_session_id AS "cashSessionId",
              count_data.branch_id AS "branchId", branch.nombre AS "branchName",
              register.nombre AS "cashRegister", terminal.name AS terminal,
              count_data.counted_at AS "countedAt", count_data.counted_cash_amount::numeric AS "countedAmount",
              count_data.expected_amount::numeric AS "expectedAmount", count_data.difference_amount::numeric AS difference,
              count_data.counted_by_user_id AS "countedByUserId", counter_user.email AS "countedBy",
              count_data.notes, session.status AS "sessionStatus", session.opened_at AS "openedAt",
              session.closed_at AS "closedAt"
         FROM public.cash_counts AS count_data
         INNER JOIN public.cash_sessions AS session
           ON session.id = count_data.cash_session_id AND session.tenant_id = count_data.tenant_id
         CROSS JOIN resolved
         LEFT JOIN public.tenant_branches AS branch
           ON branch.id = count_data.branch_id AND branch.tenant_id = count_data.tenant_id
         LEFT JOIN public.cash_registers AS register
           ON register.id = session.cash_register_id AND register.tenant_id = session.tenant_id
         LEFT JOIN public.terminals AS terminal
           ON terminal.id = register.terminal_id AND terminal.tenant_id = register.tenant_id
         LEFT JOIN public.users AS counter_user
           ON counter_user.id = count_data.counted_by_user_id AND counter_user.tenant_id = count_data.tenant_id
        WHERE count_data.tenant_id = resolved.tenant_id
          AND (resolved.branch_id IS NULL OR count_data.branch_id = resolved.branch_id)
          AND ($7::timestamptz IS NULL OR count_data.counted_at >= $7::timestamptz)
          AND ($8::timestamptz IS NULL OR count_data.counted_at < $8::timestamptz)
          AND (
            NOT resolved.restrict_to_user
            OR count_data.counted_by_user_id = $1::uuid
            OR session.opened_by_user_id = $1::uuid
          )
        ORDER BY count_data.counted_at DESC, count_data.id DESC
        LIMIT $9::integer OFFSET $10::integer`,
      [...this.exportScopeParams(actor, filters), limit, offset],
    );
    return result.rows.map((row) => ({
      ...row,
      countedAmount: Number(row.countedAmount),
      expectedAmount: Number(row.expectedAmount),
      difference: Number(row.difference),
    }));
  }

  async getPrintableCompany(actor: ReportActorContext): Promise<PrintableCompanyHeader> {
    const result = await this.db.query<{
      tenantName: string | null; config: unknown; legalName: string | null; nit: string | null;
      dv: string | null; taxResponsibilities: string | null; regime: string | null;
      vatResponsibility: string | null; address: string | null; city: string | null;
      department: string | null; country: string | null; phone: string | null; email: string | null;
      website: string | null; branchName: string | null; branchAddress: string | null;
      branchCity: string | null; branchDepartment: string | null; branchCountry: string | null;
      branchPhone: string | null; branchEmail: string | null;
    }>(
      `SELECT t.nombre AS "tenantName", t.config,
              td.razon_social AS "legalName", td.nit, td.dv,
              td.responsabilidades_dian AS "taxResponsibilities", td.regimen,
              td.vat_responsibility AS "vatResponsibility", td.direccion_principal AS address,
              td.ciudad AS city, td.departamento AS department, td.pais AS country,
              td.telefono AS phone, td.email_corporativo AS email, td.sitio_web AS website,
              tb.nombre AS "branchName", tb.direccion AS "branchAddress", tb.ciudad AS "branchCity",
              tb.departamento AS "branchDepartment", tb.pais AS "branchCountry",
              tb.telefono AS "branchPhone", tb.email AS "branchEmail"
         FROM public.tenants AS t
         LEFT JOIN public.tenants_detalles AS td ON td.tenant_id = t.id
         LEFT JOIN public.tenant_branches AS tb
           ON tb.tenant_id = t.id
          AND (($2::uuid IS NOT NULL AND tb.id = $2::uuid)
            OR ($2::uuid IS NULL AND tb.es_principal = TRUE))
        WHERE t.id = $1::uuid AND t.activo = TRUE
        LIMIT 1`,
      [actor.tenantId, actor.branchId],
    );
    const row = result.rows[0];
    const config = row?.config && typeof row.config === "object"
      ? row.config as Record<string, unknown>
      : {};
    const logo = typeof config.logo === "string"
      ? config.logo
      : typeof config.logoUrl === "string" ? config.logoUrl : null;
    return {
      tenantName: row?.tenantName ?? null, legalName: row?.legalName ?? row?.tenantName ?? null,
      nit: row?.nit ?? null, dv: row?.dv ?? null, taxResponsibilities: row?.taxResponsibilities ?? null,
      regime: row?.regime ?? null, vatResponsibility: row?.vatResponsibility ?? null,
      address: row?.address ?? null, city: row?.city ?? null, department: row?.department ?? null,
      country: row?.country ?? null, phone: row?.phone ?? null, email: row?.email ?? null,
      website: row?.website ?? null, logo, branchName: row?.branchName ?? null,
      branchAddress: row?.branchAddress ?? null, branchCity: row?.branchCity ?? null,
      branchDepartment: row?.branchDepartment ?? null, branchCountry: row?.branchCountry ?? null,
      branchPhone: row?.branchPhone ?? null, branchEmail: row?.branchEmail ?? null,
    };
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
