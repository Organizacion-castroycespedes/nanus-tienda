import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import type { OperationalSaleScope } from "../../common/services/operational-sale-scope.service";
import type { NormalizedOperationalDashboardQuery } from "./dto/operational-dashboard-query.dto";

export type OperationalDashboardResult = {
  metrics: Record<string, number>;
  dailyTrend: Array<Record<string, string | number>>;
  statusDistribution: Array<{ status: string; count: number }>;
  branches: Array<{ id: string; name: string | null }>;
};
type MetricRow = QueryResultRow & { total_sales_count: string; total_sales_amount: string; average_ticket: string; electronic_documents_count: string; accepted_count: string; rejected_count: string; pending_count: string; processing_count: string; technical_error_count: string; cancelled_count: string; accepted_amount: string; attention_count: string };
type TrendRow = QueryResultRow & { date: string; sales_count: string; sales_amount: string; electronic_documents_count: string; accepted_count: string; rejected_count: string; pending_processing_count: string };
type StatusRow = QueryResultRow & { status: string; count: string };

@Injectable()
export class OperationalDashboardRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async getDashboard(scope: OperationalSaleScope, query: NormalizedOperationalDashboardQuery): Promise<OperationalDashboardResult> {
    const { where, params } = this.scopeWhere(scope, query);
    const currentDocument = "LEFT JOIN LATERAL (SELECT d.* FROM electronic_documents d WHERE d.tenant_id=s.tenant_id AND d.source_type='SALE' AND d.source_id=s.id ORDER BY d.created_at DESC,d.id DESC LIMIT 1) d ON TRUE";
    const base = `FROM sales s ${currentDocument} WHERE ${where.join(" AND ")}`;
    const [metrics, trend, statuses, branches] = await Promise.all([
      this.db.query<MetricRow>(`SELECT COUNT(*)::text total_sales_count,COALESCE(SUM(s.total),0)::text total_sales_amount,COALESCE(AVG(s.total),0)::text average_ticket,COUNT(d.id)::text electronic_documents_count,COUNT(*) FILTER(WHERE d.status='ACCEPTED')::text accepted_count,COUNT(*) FILTER(WHERE d.status='REJECTED')::text rejected_count,COUNT(*) FILTER(WHERE d.status='PENDING')::text pending_count,COUNT(*) FILTER(WHERE d.status='PROCESSING')::text processing_count,COUNT(*) FILTER(WHERE d.status='TECHNICAL_ERROR')::text technical_error_count,COUNT(*) FILTER(WHERE d.status='CANCELLED')::text cancelled_count,COALESCE(SUM(d.total_amount) FILTER(WHERE d.status='ACCEPTED'),0)::text accepted_amount,COUNT(*) FILTER(WHERE d.status IN('REJECTED','TECHNICAL_ERROR','MANUAL_REVIEW'))::text attention_count ${base}`, params),
      this.db.query<TrendRow>(`SELECT to_char(date_trunc('day',s.created_at),'YYYY-MM-DD') date,COUNT(*)::text sales_count,COALESCE(SUM(s.total),0)::text sales_amount,COUNT(d.id)::text electronic_documents_count,COUNT(*) FILTER(WHERE d.status='ACCEPTED')::text accepted_count,COUNT(*) FILTER(WHERE d.status='REJECTED')::text rejected_count,COUNT(*) FILTER(WHERE d.status IN('PENDING','PROCESSING'))::text pending_processing_count ${base} GROUP BY date_trunc('day',s.created_at) ORDER BY date_trunc('day',s.created_at)`, params),
      this.db.query<StatusRow>(`SELECT COALESCE(d.status,'NO_DOCUMENT') status,COUNT(*)::text count ${base} GROUP BY COALESCE(d.status,'NO_DOCUMENT') ORDER BY status`, params),
      scope.allTenants ? this.db.query<{ id: string; name: string | null }>("SELECT id,nombre AS name FROM tenant_branches WHERE estado<>'INACTIVE' ORDER BY nombre") : this.db.query<{ id: string; name: string | null }>("SELECT id,nombre AS name FROM tenant_branches WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND estado<>'INACTIVE' ORDER BY nombre", [scope.tenantId, scope.branchIds ?? []]),
    ]);
    const row = metrics.rows[0]; const n = (v?: string) => Number(v ?? 0); const docs = n(row?.electronic_documents_count);
    return { metrics: { totalSalesCount:n(row?.total_sales_count),totalSalesAmount:n(row?.total_sales_amount),averageTicket:n(row?.average_ticket),electronicDocumentsCount:docs,electronicAcceptedCount:n(row?.accepted_count),electronicRejectedCount:n(row?.rejected_count),electronicPendingCount:n(row?.pending_count),electronicProcessingCount:n(row?.processing_count),electronicTechnicalErrorCount:n(row?.technical_error_count),electronicCancelledCount:n(row?.cancelled_count),electronicAcceptedAmount:n(row?.accepted_amount),electronicAcceptanceRate:docs?n(row?.accepted_count)/docs:0,documentsRequiringAttention:n(row?.attention_count) }, dailyTrend:trend.rows.map((x)=>({date:x.date,salesCount:n(x.sales_count),salesAmount:n(x.sales_amount),electronicDocumentsCount:n(x.electronic_documents_count),acceptedCount:n(x.accepted_count),rejectedCount:n(x.rejected_count),pendingOrProcessingCount:n(x.pending_processing_count)})), statusDistribution:statuses.rows.map((x)=>({status:x.status,count:n(x.count)})), branches:branches.rows };
  }
  private scopeWhere(scope: OperationalSaleScope, query: NormalizedOperationalDashboardQuery) {
    const params: unknown[] = [query.dateFrom, query.dateTo]; const where = ["s.created_at >= $1::date","s.created_at < ($2::date + INTERVAL '1 day')"];
    if (!scope.allTenants) { params.push(scope.tenantId); where.push(`s.tenant_id=$${params.length}`); }
    if (scope.branchIds) { params.push(scope.branchIds); where.push(`s.branch_id=ANY($${params.length}::uuid[])`); }
    if (scope.cashSessionId) { params.push(scope.cashSessionId); where.push(`EXISTS(SELECT 1 FROM payments p_scope WHERE p_scope.tenant_id=s.tenant_id AND p_scope.reference_type='SALE' AND p_scope.reference_id=s.id AND p_scope.cash_session_id=$${params.length})`); }
    if (scope.userId) { params.push(scope.userId); where.push(`s.user_id=$${params.length}`); }
    if (query.branchId) { params.push(query.branchId); where.push(`s.branch_id=$${params.length}`); }
    return { where, params };
  }
}
