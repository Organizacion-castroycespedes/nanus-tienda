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
