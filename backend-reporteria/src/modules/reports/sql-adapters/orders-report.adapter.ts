import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../database/database.service";
import { FunctionRunnerService } from "../../database/function-runner.service";
import type {
  OrderSaleTicketDataset,
  OrderSalesListDataset,
  OrderSalesListRow,
  ReportActorContext,
} from "../types/orders-report.types";

type OrdersListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  customerDocument?: string;
};

export type OrdersExportFilters = OrdersListParams;

@Injectable()
export class OrdersReportAdapter {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async getOrderSalesList(
    actor: ReportActorContext,
    filters: OrdersListParams
  ): Promise<OrderSalesListDataset | null> {
    const result = await this.databaseService.query<OrderSalesListRow>(
      `${this.exportFromSql()} SELECT order_id AS "orderId", order_date::text AS date, customer_name AS "customerName", total, paid, balance, status, payment_status AS "paymentStatus", branch_id AS "branchId", branch_name AS "branchName", generated_sale_id AS "generatedSaleId" FROM order_rows ORDER BY order_date DESC, order_id DESC`,
      this.exportParams(actor, filters),
    );
    const rows = result.rows.map((row) => this.mapOrderRow(row));
    return {
      filters: {
        tenantId: filters.tenantId ?? actor.tenantId,
        branchId: filters.branchId ?? actor.branchId ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
        customerDocument: filters.customerDocument ?? null,
        actorRole: actor.role,
      },
      rows,
      summary: {
        count: rows.length,
        total: rows.reduce((sum, row) => sum + row.total, 0),
        paid: rows.reduce((sum, row) => sum + row.paid, 0),
        balance: rows.reduce((sum, row) => sum + row.balance, 0),
        completed: rows.filter((row) => row.status === "COMPLETED").length,
        partial: rows.filter((row) => row.status === "PARTIAL" || row.paymentStatus === "PARTIAL").length,
        pending: rows.filter((row) => ["DRAFT", "CONFIRMED"].includes(row.status) || row.paymentStatus === "PENDING").length,
      },
    };
  }

  private exportParams(actor: ReportActorContext, filters: OrdersExportFilters) {
    return [
      actor.userId,
      actor.role,
      actor.tenantId,
      actor.branchId,
      filters.tenantId ?? null,
      filters.branchId ?? null,
      filters.dateFrom ?? null,
      filters.dateTo ?? null,
      filters.customerDocument?.trim() || null,
    ];
  }

  private exportFromSql() {
    return `
      WITH resolved AS (
        SELECT (scope->>'tenantId')::uuid AS tenant_id,
               NULLIF(scope->>'branchId', '')::uuid AS branch_id,
               COALESCE((scope->>'restrictToUser')::boolean, FALSE) AS restrict_to_user
          FROM public.report_resolve_pos_scope($2::text, $3::uuid, $4::uuid, $5::uuid, $6::uuid) AS scope
      ), order_rows AS (
        SELECT o.id AS order_id, o.created_at AS order_date, customer.name AS customer_name,
          o.status, COALESCE(o.payment_status, 'PENDING') AS payment_status,
          o.total::numeric AS total, COALESCE(o.total_paid, 0)::numeric AS paid,
          COALESCE(o.balance_due, GREATEST(o.total - COALESCE(o.total_paid, 0), 0))::numeric AS balance,
          COALESCE(sale_context.branch_id, payment_context.branch_id) AS branch_id,
          branch.nombre AS branch_name, sale_context.sale_id AS generated_sale_id
        FROM public.orders AS o
        INNER JOIN public.customers AS customer ON customer.id = o.customer_id AND customer.tenant_id = o.tenant_id
        LEFT JOIN LATERAL (
          SELECT s.id AS sale_id, s.branch_id, s.user_id FROM public.sales AS s
           WHERE s.tenant_id = o.tenant_id AND s.order_id = o.id
           ORDER BY s.created_at ASC, s.id ASC LIMIT 1
        ) AS sale_context ON TRUE
        LEFT JOIN LATERAL (
          SELECT payment_scope.branch_id, payment_scope.created_by FROM (
            SELECT pay.branch_id, pay.created_by, pay.created_at, pay.id
              FROM public.payments AS pay
             WHERE pay.tenant_id = o.tenant_id AND pay.reference_type = 'SALES_ORDER' AND pay.reference_id = o.id
            UNION ALL
            SELECT pay.branch_id, pay.created_by, pay.created_at, pay.id
              FROM public.payment_allocations AS allocation
              INNER JOIN public.payments AS pay ON pay.id = allocation.payment_id
             WHERE pay.tenant_id = o.tenant_id AND allocation.reference_type = 'SALES_ORDER' AND allocation.reference_id = o.id
          ) AS payment_scope
          ORDER BY payment_scope.created_at ASC, payment_scope.id ASC LIMIT 1
        ) AS payment_context ON TRUE
        LEFT JOIN public.tenant_branches AS branch
          ON branch.id = COALESCE(sale_context.branch_id, payment_context.branch_id) AND branch.tenant_id = o.tenant_id
        CROSS JOIN resolved
        WHERE o.tenant_id = resolved.tenant_id
          AND ($7::timestamptz IS NULL OR o.created_at >= $7::timestamptz)
          AND ($8::timestamptz IS NULL OR o.created_at < $8::timestamptz)
          AND (resolved.branch_id IS NULL OR COALESCE(sale_context.branch_id, payment_context.branch_id) = resolved.branch_id)
          AND (
            $9::text IS NULL
            OR COALESCE(
              NULLIF(BTRIM(customer.document_number_normalized), ''),
              NULLIF(regexp_replace(UPPER(BTRIM(customer.identification_number)), '[^0-9A-Z]', '', 'g'), ''),
              NULLIF(regexp_replace(UPPER(BTRIM(customer.document_number)), '[^0-9A-Z]', '', 'g'), '')
            ) ILIKE '%' || $9::text || '%'
          )
          AND (NOT resolved.restrict_to_user
            OR EXISTS (SELECT 1 FROM public.sales AS sales_scope WHERE sales_scope.tenant_id = o.tenant_id AND sales_scope.order_id = o.id AND sales_scope.user_id = $1::uuid)
            OR EXISTS (SELECT 1 FROM public.payments AS pay_scope WHERE pay_scope.tenant_id = o.tenant_id AND pay_scope.reference_type = 'SALES_ORDER' AND pay_scope.reference_id = o.id AND pay_scope.created_by = $1::uuid)
            OR EXISTS (SELECT 1 FROM public.payment_allocations AS allocation_scope INNER JOIN public.payments AS pay_scope ON pay_scope.id = allocation_scope.payment_id WHERE pay_scope.tenant_id = o.tenant_id AND allocation_scope.reference_type = 'SALES_ORDER' AND allocation_scope.reference_id = o.id AND pay_scope.created_by = $1::uuid))
      )`;
  }

  private mapOrderRow(row: OrderSalesListRow): OrderSalesListRow {
    return { ...row, total: Number(row.total), paid: Number(row.paid), balance: Number(row.balance), branchId: row.branchId ?? null, branchName: row.branchName ?? null, generatedSaleId: row.generatedSaleId ?? null };
  }

  async getOrderSalesExportCount(actor: ReportActorContext, filters: OrdersExportFilters, client: PoolClient) {
    const result = await client.query<{ count: string }>(`${this.exportFromSql()} SELECT COUNT(*)::text AS count FROM order_rows`, this.exportParams(actor, filters));
    return Number(result.rows[0]?.count ?? 0);
  }

  async getOrderSalesExportBatch(actor: ReportActorContext, filters: OrdersExportFilters, client: PoolClient, offset: number, limit: number): Promise<OrderSalesListRow[]> {
    const result = await client.query<OrderSalesListRow>(`${this.exportFromSql()} SELECT order_id AS "orderId", order_date::text AS date, customer_name AS "customerName", total, paid, balance, status, payment_status AS "paymentStatus", branch_id AS "branchId", branch_name AS "branchName", generated_sale_id AS "generatedSaleId" FROM order_rows ORDER BY order_date DESC, order_id DESC LIMIT $10::integer OFFSET $11::integer`, [...this.exportParams(actor, filters), limit, offset]);
    return result.rows.map((row) => this.mapOrderRow(row));
  }

  async getOrderSaleTicket(
    actor: ReportActorContext,
    orderId: string
  ): Promise<OrderSaleTicketDataset | null> {
    return this.functionRunnerService.executeFunction<OrderSaleTicketDataset | null>(
      "report_order_sale_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, orderId]
    );
  }

  async orderSaleExists(orderId: string): Promise<boolean> {
    const result = await this.databaseService.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM orders WHERE id = $1) AS exists",
      [orderId]
    );
    return result.rows[0]?.exists === true;
  }
}
