import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import type { OperationalSaleScope } from "../../common/services/operational-sale-scope.service";
import type { NormalizedOperationalSalesQuery } from "./dto/operational-sales-query.dto";

type SaleQueryRow = QueryResultRow & {
  sale_id: string;
  tenant_id: string;
  branch_id: string;
  terminal_id: string | null;
  user_id: string | null;
  pos_session_id: string | null;
  cash_session_id: string | null;
  sale_status: string;
  sale_type: string;
  total: string;
  balance: string;
  payment_status: string;
  total_paid: string | null;
  balance_due: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string | null;
  branch_name: string | null;
  operator_email: string | null;
  billing_status: string | null;
  billing_document_id: string | null;
  billing_document_number: string | null;
  billing_cufe: string | null;
  billing_provider_document_id: string | null;
  billing_provider_status: string | null;
  billing_error_code: string | null;
  billing_error_message: string | null;
  billing_created_at: string | null;
  billing_updated_at: string | null;
  billing_document_count: string;
};

export type OperationalSaleListItem = {
  id: string;
  createdAt: string;
  status: string;
  saleType: string;
  paymentStatus: string;
  total: number;
  customer: { id: string; name: string | null };
  branch: { id: string; name: string | null };
  operator: { id: string | null; email: string | null };
  cashSessionId: string | null;
  electronicBilling: {
    status: string;
    electronicDocumentId: string | null;
    documentNumber: string | null;
    cufe: string | null;
    providerDocumentId: string | null;
    providerStatus: string | null;
  } | null;
};

export type OperationalSaleDetail = OperationalSaleListItem & {
  balance: number;
  totalPaid: number | null;
  balanceDue: number | null;
  terminalId: string | null;
  posSessionId: string | null;
  electronicBilling: (NonNullable<OperationalSaleListItem["electronicBilling"]> & {
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    documentCount: number;
    retryability?: {
      canRetry: boolean;
      canRecoverProviderCreateIntent: boolean;
      retryClass: string;
      decision: string;
      reasonCode: string;
      requiredAction: string;
      requiresReconciliation: boolean;
      providerDocumentExists: boolean;
      processingStage: string;
      safeUserMessage: string;
    };
  }) | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    taxTotal: number;
    total: number;
  }>;
  payments: Array<{
    id: string;
    paymentMethod: string | null;
    amount: number;
    cashSessionId: string | null;
    status: string;
    createdAt: string;
  }>;
};

type QueryParts = { where: string[]; params: unknown[] };

@Injectable()
export class OperationalSalesRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findMany(scope: OperationalSaleScope, query: NormalizedOperationalSalesQuery) {
    const parts = this.buildQueryParts(scope, query);
    const offset = (query.page - 1) * query.limit;
    parts.params.push(query.limit, offset);
    const orderBy = this.orderBy(query.sortBy, query.sortDirection);
    const result = await this.db.query<SaleQueryRow>(
      `${this.select()} WHERE ${parts.where.join("\n AND ")}
       ORDER BY ${orderBy}, s.id DESC
       LIMIT $${parts.params.length - 1} OFFSET $${parts.params.length}`,
      parts.params
    );
    const countParts = this.buildQueryParts(scope, query);
    const count = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM sales AS s WHERE ${countParts.where.join("\n AND ")}`,
      countParts.params
    );
    return {
      items: result.rows.map((row) => this.mapList(row)),
      page: query.page,
      limit: query.limit,
      total: Number(count.rows[0]?.total ?? 0),
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    };
  }

  async findById(scope: OperationalSaleScope, saleId: string) {
    const parts = this.buildQueryParts(scope, {});
    parts.params.push(saleId);
    const result = await this.db.query<SaleQueryRow>(
      `${this.select()} WHERE ${parts.where.join("\n AND ")} AND s.id = $${parts.params.length}
       ORDER BY s.id DESC LIMIT 1`,
      parts.params
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const [itemsResult, paymentsResult] = await Promise.all([
      this.db.query<{
        id: string;
        product_id: string;
        quantity: string;
        price: string;
        subtotal: string;
        tax_total: string;
        line_total: string | null;
      }>(
        `SELECT id, product_id, quantity::text, price::text, subtotal::text,
                tax_total::text, line_total::text
           FROM sale_items
          WHERE tenant_id = $1 AND sale_id = $2
          ORDER BY created_at ASC, id ASC`,
        [row.tenant_id, saleId]
      ),
      this.db.query<{
        id: string;
        payment_method_nombre: string | null;
        amount: string;
        cash_session_id: string | null;
        status: string;
        created_at: string;
      }>(
        `SELECT payment.id, method.nombre AS payment_method_nombre,
                payment.amount::text, payment.cash_session_id,
                payment.status, payment.created_at
           FROM payments AS payment
           LEFT JOIN payment_methods AS method
             ON method.id = payment.payment_method_id
            AND method.tenant_id = payment.tenant_id
          WHERE payment.tenant_id = $1
            AND payment.reference_type = 'SALE'
            AND payment.reference_id = $2
          ORDER BY payment.created_at ASC, payment.id ASC`,
        [row.tenant_id, saleId]
      ),
    ]);
    return this.mapDetail(row, itemsResult.rows, paymentsResult.rows);
  }

  private select() {
    return `SELECT s.id AS sale_id, s.tenant_id, s.branch_id, s.terminal_id,
      s.user_id, s.pos_session_id, s.customer_id, s.status AS sale_status,
      s.type AS sale_type, s.total::text, s.balance::text,
      COALESCE(s.payment_status, 'PENDING') AS payment_status,
      s.total_paid::text, s.balance_due::text, s.created_at,
      c.name AS customer_name, branch.nombre AS branch_name,
      operator.email AS operator_email,
      payment_context.cash_session_id,
      document.id AS billing_document_id, document.status AS billing_status,
      COALESCE(document.full_number,
        CONCAT(COALESCE(document.prefix, ''), document.number::text)) AS billing_document_number,
      document.cufe AS billing_cufe, document.provider_document_id AS billing_provider_document_id,
      document.provider_status AS billing_provider_status,
      document.last_error_code AS billing_error_code,
      document.last_error_message AS billing_error_message,
      document.created_at AS billing_created_at, document.updated_at AS billing_updated_at,
      COALESCE(document.document_count, 0)::text AS billing_document_count
      FROM sales AS s
      LEFT JOIN customers AS c ON c.id = s.customer_id AND c.tenant_id = s.tenant_id
      LEFT JOIN tenant_branches AS branch ON branch.id = s.branch_id AND branch.tenant_id = s.tenant_id
      LEFT JOIN users AS operator ON operator.id = s.user_id AND operator.tenant_id = s.tenant_id
      LEFT JOIN LATERAL (
        SELECT p.cash_session_id
        FROM payments AS p
        WHERE p.tenant_id = s.tenant_id AND p.reference_type = 'SALE'
          AND p.reference_id = s.id AND p.cash_session_id IS NOT NULL
        ORDER BY p.created_at DESC LIMIT 1
      ) AS payment_context ON TRUE
      LEFT JOIN LATERAL (
        SELECT d.*, COUNT(*) OVER () AS document_count
        FROM electronic_documents AS d
        WHERE d.tenant_id = s.tenant_id AND d.source_type = 'SALE' AND d.source_id = s.id
        ORDER BY d.created_at DESC LIMIT 1
      ) AS document ON TRUE`;
  }

  private buildQueryParts(scope: OperationalSaleScope, query: Partial<NormalizedOperationalSalesQuery>): QueryParts {
    const params: unknown[] = [];
    const where: string[] = [];
    if (scope.allTenants) {
      where.push("TRUE");
    } else {
      params.push(scope.tenantId);
      where.push(`s.tenant_id = $${params.length}`);
    }
    if (scope.branchIds) {
      params.push(scope.branchIds);
      where.push(`s.branch_id = ANY($${params.length}::uuid[])`);
    }
    if (scope.cashSessionId) {
      params.push(scope.cashSessionId);
      where.push(`EXISTS (SELECT 1 FROM payments AS scoped_payment
        WHERE scoped_payment.tenant_id = s.tenant_id
          AND scoped_payment.reference_type = 'SALE'
          AND scoped_payment.reference_id = s.id
          AND scoped_payment.cash_session_id = $${params.length})`);
    }
    if (scope.userId) {
      params.push(scope.userId);
      where.push(`s.user_id = $${params.length}`);
    }
    if (query.dateFrom) {
      params.push(query.dateFrom);
      where.push(`s.created_at >= $${params.length}::timestamptz`);
    }
    if (query.dateTo) {
      params.push(query.dateTo);
      where.push(`s.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (query.status) {
      params.push(query.status);
      where.push(`s.status = $${params.length}`);
    }
    if (query.paymentStatus) {
      params.push(query.paymentStatus);
      where.push(`s.payment_status = $${params.length}`);
    }
    if (query.paymentMethod) {
      params.push(query.paymentMethod);
      where.push(`EXISTS (SELECT 1 FROM payments AS method_payment
        INNER JOIN payment_methods AS method ON method.id = method_payment.payment_method_id
          AND method.tenant_id = method_payment.tenant_id
        WHERE method_payment.tenant_id = s.tenant_id
          AND method_payment.reference_type = 'SALE'
          AND method_payment.reference_id = s.id
          AND (method.codigo = $${params.length} OR method.nombre = $${params.length}))`);
    }
    if (query.customerId) {
      params.push(query.customerId);
      where.push(`s.customer_id = $${params.length}`);
    }
    if (query.documentNumber) {
      params.push(query.documentNumber);
      where.push(`EXISTS (SELECT 1 FROM electronic_documents AS filtered_document
        WHERE filtered_document.tenant_id = s.tenant_id
          AND filtered_document.source_type = 'SALE'
          AND filtered_document.source_id = s.id
          AND (filtered_document.full_number = $${params.length}
            OR CONCAT(COALESCE(filtered_document.prefix, ''), filtered_document.number::text) = $${params.length}))`);
    }
    if (query.electronicBillingStatus) {
      params.push(query.electronicBillingStatus);
      where.push(`EXISTS (SELECT 1 FROM electronic_documents AS filtered_billing
        WHERE filtered_billing.tenant_id = s.tenant_id
          AND filtered_billing.source_type = 'SALE'
          AND filtered_billing.source_id = s.id
          AND filtered_billing.status = $${params.length})`);
    }
    return { where, params };
  }

  private orderBy(field: string, direction: "ASC" | "DESC") {
    const columns: Record<string, string> = {
      createdAt: "s.created_at",
      total: "s.total",
      status: "s.status",
    };
    return `${columns[field] ?? columns.createdAt} ${direction}`;
  }

  private mapList(row: SaleQueryRow): OperationalSaleListItem {
    const billingStatus = Number(row.billing_document_count) > 1
      ? "AMBIGUOUS"
      : row.billing_status ?? "UNKNOWN";
    return {
      id: row.sale_id,
      createdAt: row.created_at,
      status: row.sale_status,
      saleType: row.sale_type,
      paymentStatus: row.payment_status,
      total: Number(row.total),
      customer: { id: row.customer_id, name: row.customer_name },
      branch: { id: row.branch_id, name: row.branch_name },
      operator: { id: row.user_id, email: row.operator_email },
      cashSessionId: row.cash_session_id,
      electronicBilling: row.billing_document_id
        ? {
            status: billingStatus,
            electronicDocumentId: row.billing_document_id,
            documentNumber: row.billing_document_number,
            cufe: row.billing_cufe,
            providerDocumentId: row.billing_provider_document_id,
            providerStatus: row.billing_provider_status,
          }
        : null,
    };
  }

  private mapDetail(
    row: SaleQueryRow,
    itemRows: Array<{
      id: string;
      product_id: string;
      quantity: string;
      price: string;
      subtotal: string;
      tax_total: string;
      line_total: string | null;
    }>,
    paymentRows: Array<{
      id: string;
      payment_method_nombre: string | null;
      amount: string;
      cash_session_id: string | null;
      status: string;
      created_at: string;
    }>
  ): OperationalSaleDetail {
    const item = this.mapList(row);
    return {
      ...item,
      balance: Number(row.balance),
      totalPaid: row.total_paid === null ? null : Number(row.total_paid),
      balanceDue: row.balance_due === null ? null : Number(row.balance_due),
      terminalId: row.terminal_id,
      posSessionId: row.pos_session_id,
      electronicBilling: item.electronicBilling
        ? {
            ...item.electronicBilling,
            providerErrorCode: row.billing_error_code,
            providerErrorMessage: row.billing_error_message,
            createdAt: row.billing_created_at,
            updatedAt: row.billing_updated_at,
            documentCount: Number(row.billing_document_count),
          }
        : null,
      items: itemRows.map((item) => ({
        id: item.id,
        productId: item.product_id,
        quantity: Number(item.quantity),
        unitPrice: Number(item.price),
        subtotal: Number(item.subtotal),
        taxTotal: Number(item.tax_total),
        total: Number(item.line_total ?? item.subtotal),
      })),
      payments: paymentRows.map((payment) => ({
        id: payment.id,
        paymentMethod: payment.payment_method_nombre,
        amount: Number(payment.amount),
        cashSessionId: payment.cash_session_id,
        status: payment.status,
        createdAt: payment.created_at,
      })),
    };
  }
}
