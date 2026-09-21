import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../database/database.service";
import { FunctionRunnerService } from "../../database/function-runner.service";
import type {
  PurchaseTicketDataset,
  PurchasesReportListDataset,
  PurchaseReportListRow,
  ReportActorContext,
} from "../types/purchases-report.types";

type PurchasesListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  supplierInvoiceNumber?: string;
};

export type PurchasesExportFilters = PurchasesListParams;

@Injectable()
export class PurchasesReportAdapter {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async getPurchasesList(
    actor: ReportActorContext,
    filters: PurchasesListParams
  ): Promise<PurchasesReportListDataset | null> {
    const result = await this.databaseService.query<PurchaseReportListRow>(
      `${this.exportFromSql()} SELECT purchase_id AS "purchaseId", purchase_date::text AS date, supplier_name AS "supplierName", supplier_invoice_number AS "supplierInvoiceNumber", supplier_invoice_date::text AS "supplierInvoiceDate", total, total_pedido AS "totalPedido", total_liquidado AS "totalLiquidado", diferencia_no_recibida AS "diferenciaNoRecibida", paid, balance, payment_status AS "paymentStatus", branch_id AS "branchId", branch_name AS "branchName", status FROM purchase_rows ORDER BY purchase_date DESC, purchase_id DESC`,
      this.exportParams(actor, filters),
    );
    const rows = result.rows.map((row) => this.mapPurchaseRow(row));
    const active = rows.filter((row) => row.status !== "CANCELLED");
    return {
      filters: {
        tenantId: filters.tenantId ?? actor.tenantId,
        branchId: filters.branchId ?? actor.branchId ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
        status: filters.status ?? null,
        supplierInvoiceNumber: filters.supplierInvoiceNumber ?? null,
        actorRole: actor.role,
      },
      rows,
      summary: {
        count: rows.length,
        activeCount: active.length,
        cancelled: rows.length - active.length,
        total: active.reduce((sum, row) => sum + row.total, 0),
        totalNoRecibido: active.reduce((sum, row) => sum + (row.diferenciaNoRecibida ?? 0), 0),
        paid: active.reduce((sum, row) => sum + row.paid, 0),
        balance: active.reduce((sum, row) => sum + row.balance, 0),
      },
    };
  }

  private exportParams(actor: ReportActorContext, filters: PurchasesExportFilters) {
    return [
      actor.userId,
      actor.role,
      actor.tenantId,
      actor.branchId,
      filters.tenantId ?? null,
      filters.branchId ?? null,
      filters.dateFrom ?? null,
      filters.dateTo ?? null,
      filters.status ?? null,
      filters.supplierInvoiceNumber?.trim() || null,
    ];
  }

  private mapPurchaseRow(row: PurchaseReportListRow): PurchaseReportListRow {
    return { ...row, total: Number(row.total), totalPedido: Number(row.totalPedido), totalLiquidado: Number(row.totalLiquidado), diferenciaNoRecibida: Number(row.diferenciaNoRecibida), paid: Number(row.paid), balance: Number(row.balance) };
  }

  private exportFromSql() {
    return `
      WITH resolved AS (
        SELECT (scope->>'tenantId')::uuid AS tenant_id,
               NULLIF(scope->>'branchId', '')::uuid AS branch_id,
               COALESCE((scope->>'restrictToUser')::boolean, FALSE) AS restrict_to_user
          FROM public.report_resolve_pos_scope($2::text, $3::uuid, $4::uuid, $5::uuid, $6::uuid) AS scope
      ), purchase_rows AS (
        SELECT p.id AS purchase_id, p.created_at AS purchase_date, supplier.name AS supplier_name,
          p.status,
          p.supplier_invoice_number,
          p.supplier_invoice_date,
          CASE WHEN p.status = 'CERRADA_PARCIAL' THEN COALESCE(p.total_liquidado, p.total_recibido, p.total) ELSE p.total END::numeric AS total,
          COALESCE(p.total_pedido, p.total)::numeric AS total_pedido,
          COALESCE(p.total_liquidado, p.total_recibido, p.total)::numeric AS total_liquidado,
          COALESCE(p.total_no_recibido, 0)::numeric AS diferencia_no_recibida,
          COALESCE(p.total_paid, 0)::numeric AS paid,
          COALESCE(p.balance_due, p.balance, GREATEST((CASE WHEN p.status = 'CERRADA_PARCIAL' THEN COALESCE(p.total_liquidado, p.total_recibido, p.total) ELSE p.total END) - COALESCE(p.total_paid, 0), 0))::numeric AS balance,
          COALESCE(p.payment_status, CASE WHEN COALESCE(p.total_paid, 0) <= 0 THEN 'PENDING' WHEN COALESCE(p.total_paid, 0) < (CASE WHEN p.status = 'CERRADA_PARCIAL' THEN COALESCE(p.total_liquidado, p.total_recibido, p.total) ELSE p.total END) THEN 'PARTIAL' WHEN COALESCE(p.total_paid, 0) = (CASE WHEN p.status = 'CERRADA_PARCIAL' THEN COALESCE(p.total_liquidado, p.total_recibido, p.total) ELSE p.total END) THEN 'PAID' ELSE 'OVERPAID' END) AS payment_status,
          COALESCE(payment_context.branch_id, stock_context.branch_id) AS branch_id,
          branch.nombre AS branch_name
        FROM public.purchases AS p
        INNER JOIN public.suppliers AS supplier ON supplier.id = p.supplier_id AND supplier.tenant_id = p.tenant_id
        LEFT JOIN LATERAL (SELECT pay.branch_id, pay.created_by FROM public.payments AS pay WHERE pay.tenant_id = p.tenant_id AND pay.reference_type = 'PURCHASE' AND pay.reference_id = p.id ORDER BY pay.created_at ASC, pay.id ASC LIMIT 1) AS payment_context ON TRUE
        LEFT JOIN LATERAL (SELECT sm.branch_id, sm.user_id FROM public.stock_movements AS sm WHERE sm.tenant_id = p.tenant_id AND sm.reference_type = 'PURCHASE' AND sm.reference_id = p.id ORDER BY sm.created_at ASC, sm.id ASC LIMIT 1) AS stock_context ON TRUE
        LEFT JOIN public.tenant_branches AS branch ON branch.id = COALESCE(payment_context.branch_id, stock_context.branch_id) AND branch.tenant_id = p.tenant_id
        CROSS JOIN resolved
        WHERE p.tenant_id = resolved.tenant_id
          AND ($7::timestamptz IS NULL OR p.created_at >= $7::timestamptz)
          AND ($8::timestamptz IS NULL OR p.created_at < $8::timestamptz)
          AND ($9::text IS NULL OR p.status = $9::text)
          AND ($10::text IS NULL OR p.supplier_invoice_number ILIKE '%' || $10::text || '%')
          AND (resolved.branch_id IS NULL OR COALESCE(payment_context.branch_id, stock_context.branch_id) = resolved.branch_id)
          AND (NOT resolved.restrict_to_user OR EXISTS (SELECT 1 FROM public.payments AS pay_scope WHERE pay_scope.tenant_id = p.tenant_id AND pay_scope.reference_type = 'PURCHASE' AND pay_scope.reference_id = p.id AND pay_scope.created_by = $1::uuid) OR EXISTS (SELECT 1 FROM public.stock_movements AS sm_scope WHERE sm_scope.tenant_id = p.tenant_id AND sm_scope.reference_type = 'PURCHASE' AND sm_scope.reference_id = p.id AND sm_scope.user_id = $1::uuid) OR EXISTS (SELECT 1 FROM public.auditoria_eventos AS ae_scope WHERE ae_scope.tenant_id = p.tenant_id AND ae_scope.entidad = 'purchases' AND ae_scope.entidad_id = p.id::text AND ae_scope.usuario_id = $1::uuid))
      )`;
  }

  async getPurchasesExportCount(actor: ReportActorContext, filters: PurchasesExportFilters, client: PoolClient) {
    const result = await client.query<{ count: string }>(`${this.exportFromSql()} SELECT COUNT(*)::text AS count FROM purchase_rows`, this.exportParams(actor, filters));
    return Number(result.rows[0]?.count ?? 0);
  }

  async getPurchasesExportBatch(actor: ReportActorContext, filters: PurchasesExportFilters, client: PoolClient, offset: number, limit: number): Promise<PurchaseReportListRow[]> {
    const result = await client.query<PurchaseReportListRow>(`${this.exportFromSql()} SELECT purchase_id AS "purchaseId", purchase_date::text AS date, supplier_name AS "supplierName", supplier_invoice_number AS "supplierInvoiceNumber", supplier_invoice_date::text AS "supplierInvoiceDate", total, total_pedido AS "totalPedido", total_liquidado AS "totalLiquidado", diferencia_no_recibida AS "diferenciaNoRecibida", paid, balance, payment_status AS "paymentStatus", branch_id AS "branchId", branch_name AS "branchName", status FROM purchase_rows ORDER BY purchase_date DESC, purchase_id DESC LIMIT $11::integer OFFSET $12::integer`, [...this.exportParams(actor, filters), limit, offset]);
    return result.rows.map((row) => this.mapPurchaseRow(row));
  }

  async getPurchaseTicket(
    actor: ReportActorContext,
    purchaseId: string
  ): Promise<PurchaseTicketDataset | null> {
    return this.functionRunnerService.executeFunction<PurchaseTicketDataset | null>(
      "report_purchase_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, purchaseId]
    );
  }
}
