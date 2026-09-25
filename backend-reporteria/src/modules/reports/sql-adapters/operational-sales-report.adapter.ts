import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../database/database.service";
import type { OperationalSalesReportQuery, OperationalSalesReportRow, OperationalSalesScope } from "../types/operational-sales-report.types";

type Row = QueryResultRow & { sale_id: string; created_at: string; sale_status: string; sale_type: string; payment_status: string; total: string; customer_name: string | null; branch_name: string | null; operator_email: string | null; cash_session_id: string | null; billing_document_id: string | null; billing_status: string | null; billing_document_number: string | null; billing_cufe: string | null; billing_provider_status: string | null; billing_document_count: string };
type Parts = { where: string[]; params: unknown[] };

@Injectable()
export class OperationalSalesReportAdapter {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async count(scope: OperationalSalesScope, query: OperationalSalesReportQuery, client: PoolClient) {
    const parts = this.parts(scope, query);
    const result = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM sales s WHERE ${parts.where.join(" AND ")}`, parts.params);
    return Number(result.rows[0]?.total ?? 0);
  }

  async batch(scope: OperationalSalesScope, query: OperationalSalesReportQuery, client: PoolClient, offset: number, limit: number) {
    const parts = this.parts(scope, query);
    parts.params.push(limit, offset);
    const result = await client.query<Row>(`${this.select()} WHERE ${parts.where.join(" AND ")} ORDER BY ${this.order(query)} , s.id DESC LIMIT $${parts.params.length - 1} OFFSET $${parts.params.length}`, parts.params);
    return result.rows.map((row) => this.map(row));
  }

  private select() {
    return `SELECT s.id sale_id, s.created_at, s.status sale_status, s.type sale_type, COALESCE(s.payment_status, 'PENDING') payment_status, s.total::text total,
      c.name customer_name, branch.nombre branch_name, operator.email operator_email, payment_context.cash_session_id,
      document.id billing_document_id, document.status billing_status, COALESCE(document.full_number, CONCAT(COALESCE(document.prefix, ''), document.number::text)) billing_document_number,
      document.cufe billing_cufe, document.provider_status billing_provider_status, COALESCE(document.document_count, 0)::text billing_document_count
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id AND c.tenant_id = s.tenant_id
      LEFT JOIN tenant_branches branch ON branch.id = s.branch_id AND branch.tenant_id = s.tenant_id
      LEFT JOIN users operator ON operator.id = s.user_id AND operator.tenant_id = s.tenant_id
      LEFT JOIN LATERAL (SELECT p.cash_session_id FROM payments p WHERE p.tenant_id = s.tenant_id AND p.reference_type = 'SALE' AND p.reference_id = s.id AND p.cash_session_id IS NOT NULL ORDER BY p.created_at DESC LIMIT 1) payment_context ON TRUE
      LEFT JOIN LATERAL (SELECT d.*, COUNT(*) OVER () document_count FROM electronic_documents d WHERE d.tenant_id = s.tenant_id AND d.source_type = 'SALE' AND d.source_id = s.id ORDER BY d.created_at DESC LIMIT 1) document ON TRUE`;
  }

  private parts(scope: OperationalSalesScope, query: OperationalSalesReportQuery): Parts {
    const params: unknown[] = [scope.tenantId, scope.branchIds];
    const where = ["s.tenant_id = $1", "s.branch_id = ANY($2::uuid[])"];
    const add = (value: unknown, sql: (position: number) => string) => { params.push(value); where.push(sql(params.length)); };
    if (scope.cashSessionId) where.push(`EXISTS (SELECT 1 FROM payments p_scope WHERE p_scope.tenant_id = s.tenant_id AND p_scope.reference_type = 'SALE' AND p_scope.reference_id = s.id AND p_scope.cash_session_id = $${params.push(scope.cashSessionId)})`);
    if (scope.userId) add(scope.userId, (p) => `s.user_id = $${p}`);
    if (query.dateFrom) add(query.dateFrom, (p) => `s.created_at >= $${p}::timestamptz`);
    if (query.dateTo) add(query.dateTo, (p) => `s.created_at < ($${p}::date + INTERVAL '1 day')`);
    if (query.status) add(query.status, (p) => `s.status = $${p}`);
    if (query.paymentStatus) add(query.paymentStatus, (p) => `s.payment_status = $${p}`);
    if (query.paymentMethod) add(query.paymentMethod, (p) => `EXISTS (SELECT 1 FROM payments pm JOIN payment_methods method ON method.id = pm.payment_method_id AND method.tenant_id = pm.tenant_id WHERE pm.tenant_id = s.tenant_id AND pm.reference_type = 'SALE' AND pm.reference_id = s.id AND (method.codigo = $${p} OR method.nombre = $${p}))`);
    if (query.customerId) add(query.customerId, (p) => `s.customer_id = $${p}`);
    if (query.documentNumber) add(query.documentNumber, (p) => `EXISTS (SELECT 1 FROM electronic_documents d_filter WHERE d_filter.tenant_id = s.tenant_id AND d_filter.source_type = 'SALE' AND d_filter.source_id = s.id AND (d_filter.full_number = $${p} OR CONCAT(COALESCE(d_filter.prefix, ''), d_filter.number::text) = $${p}))`);
    if (query.electronicBillingStatus) add(query.electronicBillingStatus, (p) => `EXISTS (SELECT 1 FROM electronic_documents d_status WHERE d_status.tenant_id = s.tenant_id AND d_status.source_type = 'SALE' AND d_status.source_id = s.id AND d_status.status = $${p})`);
    if (query.userId && !scope.userId) add(query.userId, (p) => `s.user_id = $${p}`);
    if (query.cashSessionId && !scope.cashSessionId) add(query.cashSessionId, (p) => `EXISTS (SELECT 1 FROM payments p_filter WHERE p_filter.tenant_id = s.tenant_id AND p_filter.reference_type = 'SALE' AND p_filter.reference_id = s.id AND p_filter.cash_session_id = $${p})`);
    return { where, params };
  }

  private order(query: OperationalSalesReportQuery) {
    const columns = { createdAt: "s.created_at", total: "s.total", status: "s.status" } as const;
    return `${columns[query.sortBy ?? "createdAt"] ?? columns.createdAt} ${query.sortDirection === "ASC" ? "ASC" : "DESC"}`;
  }

  private map(row: Row): OperationalSalesReportRow {
    return { id: row.sale_id, createdAt: row.created_at, status: row.sale_status, saleType: row.sale_type, paymentStatus: row.payment_status, total: Number(row.total), customerName: row.customer_name, branchName: row.branch_name, operatorEmail: row.operator_email, cashSessionId: row.cash_session_id, electronicBillingStatus: Number(row.billing_document_count) > 1 ? "AMBIGUOUS" : row.billing_status ?? "UNKNOWN", electronicDocumentNumber: row.billing_document_number, electronicCufe: row.billing_cufe, providerStatus: row.billing_provider_status };
  }
}
