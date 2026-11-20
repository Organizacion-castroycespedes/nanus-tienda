import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import { DEFAULT_QUOTATION_VALIDITY_DAYS, type QuotationStatus } from "./quotation.policy";

export type QuotationRow = {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_document: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_is_active: boolean | null;
  code: string;
  status: QuotationStatus;
  effective_status: string;
  issue_date: string | Date;
  validity_days: number;
  valid_until: string | Date;
  subtotal: string | number;
  discount_total: string | number;
  tax_total: string | number;
  total: string | number;
  commercial_terms: string | null;
  payment_delivery_terms: string | null;
  warranty_terms: string | null;
  notes: string | null;
  pricing_calculated_at: string | Date;
  sent_at: string | Date | null;
  approved_at: string | Date | null;
  approved_by_user_id: string | null;
  rejected_at: string | Date | null;
  rejection_reason: string | null;
  converted_order_id: string | null;
  converted_at: string | Date | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type QuotationItemRow = {
  id: string;
  quotation_id: string;
  line_number: number;
  product_id: string;
  product_name: string;
  product_code: string | null;
  unit_code: string | null;
  quantity: string | number;
  base_unit_price: string | number;
  final_unit_price: string | number;
  discount_amount: string | number;
  discount_percent: string | number;
  discount_total: string | number;
  applied_promotion_id: string | null;
  applied_promotion_name: string | null;
  tax_id: string | null;
  tax_rate: string | number;
  tax_base: string | number;
  tax_amount: string | number;
  line_total: string | number;
  pricing_snapshot: Record<string, unknown> | string;
};

export type QuotationProductRow = {
  id: string;
  name: string;
  sku: string | null;
  measurement_unit: string | null;
  sale_type: string | null;
  allows_decimal_quantity: boolean | null;
  is_active: boolean;
};

export type QuotationHeaderValues = {
  branchId: string;
  customerId: string;
  issueDate: string;
  validityDays: number;
  validUntil: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  commercialTerms: string | null;
  paymentDeliveryTerms: string | null;
  warrantyTerms: string | null;
  notes: string | null;
  pricingCalculatedAt: Date;
  userId: string | null;
};

export type QuotationItemValues = {
  lineNumber: number;
  productId: string;
  productName: string;
  productCode: string | null;
  unitCode: string | null;
  quantity: number;
  baseUnitPrice: number;
  finalUnitPrice: number;
  discountAmount: number;
  discountPercent: number;
  discountTotal: number;
  appliedPromotionId: string | null;
  appliedPromotionName: string | null;
  taxId: string | null;
  taxRate: number;
  taxBase: number;
  taxAmount: number;
  lineTotal: number;
  pricingSnapshot: Record<string, unknown>;
};

export type QuotationListFilters = {
  tenantId: string;
  branchIds?: string[];
  branchId?: string;
  customerId?: string;
  status?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  limit: number;
  offset: number;
};

export type QuotationListResult = {
  rows: QuotationRow[];
  total: number;
  approved: number;
  expired: number;
  amount: number;
};

const EFFECTIVE_STATUS_SQL = `public.fnc_quotation_effective_status(q.status, q.valid_until)`;

const HEADER_SELECT = `
  q.*,
  ${EFFECTIVE_STATUS_SQL} AS effective_status,
  c.name AS customer_name,
  c.document_number AS customer_document,
  c.email AS customer_email,
  c.phone AS customer_phone,
  c.address AS customer_address,
  c.is_active AS customer_is_active,
  b.nombre AS branch_name
`;

const HEADER_FROM = `
  FROM quotations q
  LEFT JOIN customers c ON c.id = q.customer_id AND c.tenant_id = q.tenant_id
  LEFT JOIN tenant_branches b ON b.id = q.branch_id AND b.tenant_id = q.tenant_id
`;

@Injectable()
export class QuotationRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private query<T extends QueryResultRow>(text: string, params: unknown[], client?: PoolClient) {
    return client
      ? client.query<T>(text, params)
      : (this.db.query<T>(text, params as unknown[]) as Promise<{ rows: T[] }>);
  }

  async getValidityDays(tenantId: string, client?: PoolClient) {
    const result = await this.query<{ default_validity_days: number }>(
      `SELECT default_validity_days FROM quotation_settings WHERE tenant_id = $1`,
      [tenantId],
      client
    );
    return result.rows[0]?.default_validity_days ?? DEFAULT_QUOTATION_VALIDITY_DAYS;
  }

  async saveValidityDays(tenantId: string, days: number, userId: string | null) {
    const result = await this.query<{ default_validity_days: number; updated_at: string | Date }>(
      `
        INSERT INTO quotation_settings (tenant_id, default_validity_days, updated_by_user_id, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (tenant_id) DO UPDATE
          SET default_validity_days = EXCLUDED.default_validity_days,
              updated_by_user_id = EXCLUDED.updated_by_user_id,
              updated_at = NOW()
        RETURNING default_validity_days, updated_at
      `,
      [tenantId, days, userId]
    );
    return result.rows[0];
  }

  async findProducts(client: PoolClient, tenantId: string, productIds: string[]) {
    const result = await client.query<QuotationProductRow>(
      `
        SELECT id, name, sku, measurement_unit, sale_type, allows_decimal_quantity, is_active
        FROM products
        WHERE tenant_id = $1 AND id = ANY($2::uuid[])
      `,
      [tenantId, productIds]
    );
    return new Map(result.rows.map((row) => [row.id, row]));
  }

  async findCustomer(client: PoolClient, tenantId: string, customerId: string) {
    const result = await client.query<{ id: string; is_active: boolean }>(
      `SELECT id, is_active FROM customers WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [customerId, tenantId]
    );
    return result.rows[0] ?? null;
  }

  async branchExists(client: PoolClient, tenantId: string, branchId: string) {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM tenant_branches WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [branchId, tenantId]
    );
    return Boolean(result.rows[0]);
  }

  async nextCode(client: PoolClient, tenantId: string) {
    const result = await client.query<{ code: string }>(
      `SELECT public.fnc_quotation_next_code($1::uuid) AS code`,
      [tenantId]
    );
    return result.rows[0].code;
  }

  async insertQuotation(
    client: PoolClient,
    input: { id: string; tenantId: string; code: string } & QuotationHeaderValues
  ) {
    await client.query(
      `
        INSERT INTO quotations (
          id, tenant_id, branch_id, customer_id, code, status,
          issue_date, validity_days, valid_until,
          subtotal, discount_total, tax_total, total,
          commercial_terms, payment_delivery_terms, warranty_terms, notes,
          pricing_calculated_at, created_by_user_id, updated_by_user_id
        ) VALUES (
          $1, $2, $3, $4, $5, 'DRAFT',
          $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $18
        )
      `,
      [
        input.id,
        input.tenantId,
        input.branchId,
        input.customerId,
        input.code,
        input.issueDate,
        input.validityDays,
        input.validUntil,
        input.subtotal,
        input.discountTotal,
        input.taxTotal,
        input.total,
        input.commercialTerms,
        input.paymentDeliveryTerms,
        input.warrantyTerms,
        input.notes,
        input.pricingCalculatedAt,
        input.userId,
      ]
    );
  }

  /** Reescribe encabezado y precios; con `resetToDraft` (renovar) vuelve a DRAFT y limpia el envio. */
  async updateQuotation(
    client: PoolClient,
    input: { id: string; tenantId: string; resetToDraft?: boolean } & QuotationHeaderValues
  ) {
    await client.query(
      `
        UPDATE quotations SET
          branch_id = $3,
          customer_id = $4,
          issue_date = $5,
          validity_days = $6,
          valid_until = $7,
          subtotal = $8,
          discount_total = $9,
          tax_total = $10,
          total = $11,
          commercial_terms = $12,
          payment_delivery_terms = $13,
          warranty_terms = $14,
          notes = $15,
          pricing_calculated_at = $16,
          updated_by_user_id = $17,
          status = CASE WHEN $18::boolean THEN 'DRAFT' ELSE status END,
          sent_at = CASE WHEN $18::boolean THEN NULL ELSE sent_at END,
          approved_at = CASE WHEN $18::boolean THEN NULL ELSE approved_at END,
          approved_by_user_id = CASE WHEN $18::boolean THEN NULL ELSE approved_by_user_id END,
          updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
      `,
      [
        input.id,
        input.tenantId,
        input.branchId,
        input.customerId,
        input.issueDate,
        input.validityDays,
        input.validUntil,
        input.subtotal,
        input.discountTotal,
        input.taxTotal,
        input.total,
        input.commercialTerms,
        input.paymentDeliveryTerms,
        input.warrantyTerms,
        input.notes,
        input.pricingCalculatedAt,
        input.userId,
        Boolean(input.resetToDraft),
      ]
    );
  }

  async replaceItems(
    client: PoolClient,
    tenantId: string,
    quotationId: string,
    items: QuotationItemValues[]
  ) {
    await client.query(`DELETE FROM quotation_items WHERE quotation_id = $1 AND tenant_id = $2`, [
      quotationId,
      tenantId,
    ]);
    for (const item of items) {
      await client.query(
        `
          INSERT INTO quotation_items (
            tenant_id, quotation_id, line_number, product_id, product_name, product_code, unit_code,
            quantity, base_unit_price, final_unit_price, discount_amount, discount_percent, discount_total,
            applied_promotion_id, applied_promotion_name, tax_id, tax_rate, tax_base, tax_amount,
            line_total, pricing_snapshot
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19,
            $20, $21::jsonb
          )
        `,
        [
          tenantId,
          quotationId,
          item.lineNumber,
          item.productId,
          item.productName,
          item.productCode,
          item.unitCode,
          item.quantity,
          item.baseUnitPrice,
          item.finalUnitPrice,
          item.discountAmount,
          item.discountPercent,
          item.discountTotal,
          item.appliedPromotionId,
          item.appliedPromotionName,
          item.taxId,
          item.taxRate,
          item.taxBase,
          item.taxAmount,
          item.lineTotal,
          JSON.stringify(item.pricingSnapshot),
        ]
      );
    }
  }

  async findById(
    tenantId: string,
    quotationId: string,
    options: { client?: PoolClient; forUpdate?: boolean } = {}
  ) {
    if (options.forUpdate && options.client) {
      // Bloquea solo la fila de la cotizacion (los LEFT JOIN no admiten FOR UPDATE).
      await options.client.query(
        `SELECT id FROM quotations WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [quotationId, tenantId]
      );
    }
    const result = await this.query<QuotationRow>(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM} WHERE q.id = $1 AND q.tenant_id = $2 LIMIT 1`,
      [quotationId, tenantId],
      options.client
    );
    return result.rows[0] ?? null;
  }

  async findItems(tenantId: string, quotationId: string, client?: PoolClient) {
    const result = await this.query<QuotationItemRow>(
      `
        SELECT *
        FROM quotation_items
        WHERE quotation_id = $1 AND tenant_id = $2
        ORDER BY line_number
      `,
      [quotationId, tenantId],
      client
    );
    return result.rows;
  }

  async findConvertedOrder(tenantId: string, orderId: string) {
    const result = await this.query<{ id: string; status: string; total: string | number; created_at: string | Date }>(
      `SELECT id, status, total, created_at FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [orderId, tenantId]
    );
    return result.rows[0] ?? null;
  }

  async list(filters: QuotationListFilters): Promise<QuotationListResult> {
    const params: unknown[] = [filters.tenantId];
    const where = ["q.tenant_id = $1"];
    if (filters.branchIds && filters.branchIds.length > 0) {
      params.push(filters.branchIds);
      where.push(`q.branch_id = ANY($${params.length}::uuid[])`);
    }
    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`q.branch_id = $${params.length}`);
    }
    if (filters.customerId) {
      params.push(filters.customerId);
      where.push(`q.customer_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`${EFFECTIVE_STATUS_SQL} = $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      where.push(
        `(q.code ILIKE $${params.length} OR c.name ILIKE $${params.length} OR c.document_number ILIKE $${params.length})`
      );
    }
    if (filters.fromDate) {
      params.push(filters.fromDate);
      where.push(`q.issue_date >= $${params.length}::date`);
    }
    if (filters.toDate) {
      params.push(filters.toDate);
      where.push(`q.issue_date <= $${params.length}::date`);
    }
    const whereSql = where.join(" AND ");

    const summary = await this.query<{
      total: string | number;
      approved: string | number;
      expired: string | number;
      amount: string | number | null;
    }>(
      `
        SELECT
          count(*) AS total,
          count(*) FILTER (WHERE ${EFFECTIVE_STATUS_SQL} = 'APPROVED') AS approved,
          count(*) FILTER (WHERE ${EFFECTIVE_STATUS_SQL} = 'EXPIRED') AS expired,
          COALESCE(sum(q.total), 0) AS amount
        ${HEADER_FROM}
        WHERE ${whereSql}
      `,
      params
    );

    const pageParams = [...params, filters.limit, filters.offset];
    const rows = await this.query<QuotationRow>(
      `
        SELECT ${HEADER_SELECT}
        ${HEADER_FROM}
        WHERE ${whereSql}
        ORDER BY q.issue_date DESC, q.created_at DESC
        LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}
      `,
      pageParams
    );

    const row = summary.rows[0];
    return {
      rows: rows.rows,
      total: Number(row?.total ?? 0),
      approved: Number(row?.approved ?? 0),
      expired: Number(row?.expired ?? 0),
      amount: Number(row?.amount ?? 0),
    };
  }

  async markSent(client: PoolClient, tenantId: string, id: string, userId: string | null) {
    const result = await client.query<{ sent_at: Date }>(
      `UPDATE quotations SET status = 'SENT', sent_at = NOW(), updated_by_user_id = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING sent_at`,
      [id, tenantId, userId]
    );
    return result.rows[0]?.sent_at ?? null;
  }

  /** Deshace un envio que no llego al cliente; solo si nadie cambio la cotizacion despues. */
  async revertSent(tenantId: string, id: string, sentAt: Date) {
    await this.query(
      `UPDATE quotations SET status = 'DRAFT', sent_at = NULL, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'SENT' AND sent_at = $3`,
      [id, tenantId, sentAt]
    );
  }

  /** Nombre y correo de la empresa para el mensaje (Reply-To). */
  async findCompany(tenantId: string) {
    const result = await this.query<{ name: string; legal_name: string | null; email: string | null }>(
      `SELECT t.nombre AS name, td.razon_social AS legal_name, td.email_corporativo AS email
       FROM tenants t
       LEFT JOIN tenants_detalles td ON td.tenant_id = t.id
       WHERE t.id = $1
       LIMIT 1`,
      [tenantId]
    );
    return result.rows[0] ?? null;
  }

  async markApproved(client: PoolClient, tenantId: string, id: string, userId: string | null) {
    await client.query(
      `UPDATE quotations SET status = 'APPROVED', approved_at = NOW(), approved_by_user_id = $3,
         updated_by_user_id = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, userId]
    );
  }

  async markRejected(
    client: PoolClient,
    tenantId: string,
    id: string,
    reason: string,
    userId: string | null
  ) {
    await client.query(
      `UPDATE quotations SET status = 'REJECTED', rejected_at = NOW(), rejection_reason = $3,
         updated_by_user_id = $4, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, reason, userId]
    );
  }

  async markConverted(
    client: PoolClient,
    tenantId: string,
    id: string,
    orderId: string,
    userId: string | null
  ) {
    await client.query(
      `UPDATE quotations SET status = 'CONVERTED', converted_order_id = $3, converted_at = NOW(),
         updated_by_user_id = $4, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, orderId, userId]
    );
  }
}
