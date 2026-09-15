import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import type { PaymentReferenceType, PaymentStatus } from "../entities/payment.entity";

export type PaymentRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  payment_method_id: string;
  payment_method_codigo: string | null;
  payment_method_nombre: string | null;
  payment_method_tipo: string | null;
  cash_session_id: string | null;
  cash_register_id: string | null;
  cash_register_nombre: string | null;
  reference_type: PaymentReferenceType;
  reference_id: string;
  direction: string;
  status: string;
  amount: string;
  reference_number: string | null;
  notes: string | null;
  paid_by_person_id: string | null;
  paid_by_person_name: string | null;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
};

export type PaymentAllocationRecord = {
  id: string;
  payment_id: string;
  reference_type: PaymentReferenceType;
  reference_id: string;
  allocated_amount: string;
  created_at: string;
};

export type PaymentDocumentRecord = {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  status: string;
  total: string;
  balance: string | null;
  party_id?: string | null;
};

export type PaymentMethodSummaryRecord = {
  payment_method_id: string;
  payment_method: string;
  payment_method_codigo: string | null;
  payment_method_nombre: string | null;
  payment_method_tipo: string | null;
  count: string;
  total: string;
};

export type DocumentPaymentOperationRecord = {
  id: string;
  tenant_id: string;
  operation_key: string;
  request_fingerprint: string;
  reference_type: PaymentReferenceType;
  reference_id: string;
  payment_ids: string[] | null;
  status: "PENDING" | "COMPLETED";
};

type CreatePaymentInput = {
  tenantId: string;
  branchId: string;
  paymentMethodId: string;
  cashSessionId?: string | null;
  referenceType: PaymentReferenceType;
  referenceId: string;
  direction: string;
  status: string;
  amount: number;
  referenceNumber?: string | null;
  notes?: string | null;
  paidByPersonId?: string | null;
  createdBy: string;
};

type CreatePaymentAllocationInput = {
  referenceType: PaymentReferenceType;
  referenceId: string;
  allocatedAmount: number;
};

@Injectable()
export class PaymentsRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async lockDocument(client: PoolClient, tenantId: string, type: PaymentReferenceType, id: string) {
    const table = type === "SALES_ORDER" ? "orders"
      : type === "PURCHASE" || type === "PURCHASE_ORDER" ? "purchases" : null;
    if (!table) return;
    // Table is selected exclusively from the fixed domain allowlist above.
    await client.query(`SELECT id FROM ${table} WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [id, tenantId]);
  }

  async lockPaymentCashSession(client: PoolClient, tenantId: string, id: string) {
    await client.query("SELECT id FROM cash_sessions WHERE id = $1 AND tenant_id = $2 FOR UPDATE", [id, tenantId]);
  }

  async fitsDocumentBalance(
    client: PoolClient,
    tenantId: string,
    type: "PURCHASE" | "SALES_ORDER",
    id: string,
    document: PaymentDocumentRecord,
    amounts: number[],
  ) {
    // PostgreSQL numeric is the ledger's canonical decimal arithmetic.
    const result = await client.query<{ valid: boolean }>(
      `SELECT COALESCE(SUM(value), 0) > 0 AND
        COALESCE(SUM(value), 0) <= GREATEST(0, LEAST(
          COALESCE($2::numeric, $1::numeric),
          $1::numeric - (
            SELECT COALESCE(SUM(a.allocated_amount), 0)
            FROM payment_allocations a JOIN payments p ON p.id = a.payment_id
            WHERE p.tenant_id = $3 AND a.reference_id = $4
              AND (a.reference_type = $5 OR ($5 = 'PURCHASE' AND a.reference_type = 'PURCHASE_ORDER'))
              AND p.status IN ('PENDING', 'COMPLETED')
          )
        )) AS valid FROM unnest($6::numeric[]) AS value`,
      [document.total, document.balance, tenantId, id, type, amounts.map(String)],
    );
    return result.rows[0]?.valid === true;
  }

  private async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient
  ) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query<T>(text, params);
  }

  private buildBaseQuery() {
    return `SELECT
      payment.id,
      payment.tenant_id,
      payment.branch_id,
      payment.payment_method_id,
      method.codigo AS payment_method_codigo,
      method.nombre AS payment_method_nombre,
      method.tipo AS payment_method_tipo,
      payment.cash_session_id,
      session.cash_register_id,
      register.nombre AS cash_register_nombre,
      payment.reference_type,
      payment.reference_id,
      payment.direction,
      payment.status,
      payment.amount::text AS amount,
      payment.reference_number,
      payment.notes,
      payment.paid_by_person_id,
      NULLIF(TRIM(CONCAT(COALESCE(person.nombres, ''), ' ', COALESCE(person.apellidos, ''))), '') AS paid_by_person_name,
      payment.created_by,
      creator.email AS created_by_email,
      payment.created_at
    FROM payments AS payment
    INNER JOIN payment_methods AS method
      ON method.id = payment.payment_method_id
     AND method.tenant_id = payment.tenant_id
    LEFT JOIN cash_sessions AS session
      ON session.id = payment.cash_session_id
     AND session.tenant_id = payment.tenant_id
    LEFT JOIN cash_registers AS register
      ON register.id = session.cash_register_id
     AND register.tenant_id = payment.tenant_id
    LEFT JOIN personas AS person
      ON person.id = payment.paid_by_person_id
     AND person.tenant_id = payment.tenant_id
    LEFT JOIN users AS creator
      ON creator.id = payment.created_by
     AND creator.tenant_id = payment.tenant_id`;
  }

  async claimDocumentPaymentOperation(
    client: PoolClient,
    data: {
      tenantId: string;
      operationKey: string;
      requestFingerprint: string;
      referenceType: PaymentReferenceType;
      referenceId: string;
    }
  ) {
    const inserted = await this.query<{ id: string }>(
      `INSERT INTO document_payment_operations (
        tenant_id, operation_key, request_fingerprint, reference_type, reference_id
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, operation_key) DO NOTHING
      RETURNING id`,
      [
        data.tenantId,
        data.operationKey,
        data.requestFingerprint,
        data.referenceType,
        data.referenceId,
      ],
      client
    );
    const record = await this.getDocumentPaymentOperation(
      client,
      data.tenantId,
      data.operationKey
    );
    return { created: inserted.rows.length > 0, record };
  }

  async getDocumentPaymentOperation(
    client: PoolClient,
    tenantId: string,
    operationKey: string
  ) {
    const result = await this.query<DocumentPaymentOperationRecord>(
      `SELECT id, tenant_id, operation_key, request_fingerprint,
        reference_type, reference_id, payment_ids, status
       FROM document_payment_operations
       WHERE tenant_id = $1 AND operation_key = $2
       FOR UPDATE`,
      [tenantId, operationKey],
      client
    );
    return result.rows[0] ?? null;
  }

  async completeDocumentPaymentOperation(
    client: PoolClient,
    tenantId: string,
    operationKey: string,
    paymentIds: string[]
  ) {
    await this.query<QueryResultRow>(
      `UPDATE document_payment_operations
       SET status = 'COMPLETED', payment_ids = $3::uuid[], completed_at = NOW()
       WHERE tenant_id = $1 AND operation_key = $2`,
      [tenantId, operationKey, paymentIds],
      client
    );
  }

  async listByIds(paymentIds: string[], tenantId: string, client?: PoolClient) {
    if (paymentIds.length === 0) return [] as PaymentRecord[];
    const result = await this.query<PaymentRecord>(
      `${this.buildBaseQuery()}
       WHERE payment.id = ANY($1::uuid[]) AND payment.tenant_id = $2
       ORDER BY payment.created_at ASC, payment.id ASC`,
      [paymentIds, tenantId],
      client
    );
    return result.rows ?? [];
  }

  async createPayment(client: PoolClient, data: CreatePaymentInput) {
    const result = await this.query<{ id: string }>(
      `INSERT INTO payments (
        tenant_id,
        branch_id,
        payment_method_id,
        cash_session_id,
        reference_type,
        reference_id,
        direction,
        status,
        amount,
        reference_number,
        notes,
        paid_by_person_id,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        data.tenantId,
        data.branchId,
        data.paymentMethodId,
        data.cashSessionId ?? null,
        data.referenceType,
        data.referenceId,
        data.direction,
        data.status,
        data.amount,
        data.referenceNumber ?? null,
        data.notes ?? null,
        data.paidByPersonId ?? null,
        data.createdBy,
      ],
      client
    );
    const created = result.rows[0];
    if (!created) {
      return null;
    }
    return this.findById(created.id, undefined, client);
  }

  async createAllocations(
    client: PoolClient,
    paymentId: string,
    items: CreatePaymentAllocationInput[]
  ) {
    const created: PaymentAllocationRecord[] = [];

    for (const item of items) {
      const result = await this.query<PaymentAllocationRecord>(
        `INSERT INTO payment_allocations (
          payment_id,
          reference_type,
          reference_id,
          allocated_amount
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          payment_id,
          reference_type,
          reference_id,
          allocated_amount::text AS allocated_amount,
          created_at`,
        [paymentId, item.referenceType, item.referenceId, item.allocatedAmount],
        client
      );
      const row = result.rows[0];
      if (row) {
        created.push(row);
      }
    }

    return created;
  }

  async updateAllocation(
    client: PoolClient,
    allocationId: string,
    data: {
      referenceType?: PaymentReferenceType;
      referenceId?: string;
      allocatedAmount?: number;
    }
  ) {
    const updates: string[] = [];
    const params: unknown[] = [allocationId];

    if (data.referenceType !== undefined) {
      params.push(data.referenceType);
      updates.push(`reference_type = $${params.length}`);
    }

    if (data.referenceId !== undefined) {
      params.push(data.referenceId);
      updates.push(`reference_id = $${params.length}`);
    }

    if (data.allocatedAmount !== undefined) {
      params.push(data.allocatedAmount);
      updates.push(`allocated_amount = $${params.length}`);
    }

    if (updates.length === 0) {
      return null;
    }

    const result = await this.query<PaymentAllocationRecord>(
      `UPDATE payment_allocations
      SET ${updates.join(", ")}
      WHERE id = $1
      RETURNING
        id,
        payment_id,
        reference_type,
        reference_id,
        allocated_amount::text AS allocated_amount,
        created_at`,
      params,
      client
    );

    return result.rows[0] ?? null;
  }

  async updatePaymentReference(
    client: PoolClient,
    paymentId: string,
    data: {
      referenceType: PaymentReferenceType;
      referenceId: string;
    }
  ) {
    await this.query<QueryResultRow>(
      `UPDATE payments
       SET
         reference_type = $2,
         reference_id = $3
       WHERE id = $1`,
      [paymentId, data.referenceType, data.referenceId],
      client
    );
  }

  async listAllocationsByPaymentIds(
    paymentIds: string[],
    client?: PoolClient
  ) {
    if (paymentIds.length === 0) {
      return [] as PaymentAllocationRecord[];
    }

    const result = await this.query<PaymentAllocationRecord>(
      `SELECT
        id,
        payment_id,
        reference_type,
        reference_id,
        allocated_amount::text AS allocated_amount,
        created_at
      FROM payment_allocations
      WHERE payment_id = ANY($1::uuid[])
      ORDER BY created_at ASC`,
      [paymentIds],
      client
    );
    return result.rows ?? [];
  }

  async listAllocatedPayments(
    tenantId: string,
    referenceType: PaymentReferenceType,
    referenceId: string,
    client?: PoolClient
  ) {
    const result = await this.query<PaymentRecord>(
      `${this.buildBaseQuery().replace("SELECT", "SELECT DISTINCT ON (payment.id)")}
      INNER JOIN payment_allocations AS allocation
        ON allocation.payment_id = payment.id
      WHERE payment.tenant_id = $1
        AND allocation.reference_type = $2
        AND allocation.reference_id = $3
      ORDER BY payment.id ASC, payment.created_at ASC`,
      [tenantId, referenceType, referenceId],
      client
    );

    return result.rows ?? [];
  }

  async deleteAllocation(client: PoolClient, allocationId: string) {
    await this.query<QueryResultRow>(
      `DELETE FROM payment_allocations
       WHERE id = $1`,
      [allocationId],
      client
    );
  }

  async updatePaymentStatus(
    client: PoolClient,
    paymentId: string,
    status: PaymentStatus
  ) {
    await this.query<QueryResultRow>(
      `UPDATE payments
       SET status = $2
       WHERE id = $1`,
      [paymentId, status],
      client
    );
  }

  async createCashRefundMovement(
    client: PoolClient,
    data: {
      tenantId: string;
      branchId: string;
      cashSessionId: string;
      paymentId: string;
      amount: number;
      createdBy: string;
      referenceId: string;
      description?: string | null;
    }
  ) {
    await this.query<QueryResultRow>(
      `INSERT INTO cash_movements (
        tenant_id,
        branch_id,
        cash_session_id,
        payment_id,
        movement_type,
        direction,
        reference_type,
        reference_id,
        amount,
        description,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, 'PAYMENT', 'OUT', 'REFUND', $5, $6, $7, $8
      )`,
      [
        data.tenantId,
        data.branchId,
        data.cashSessionId,
        data.paymentId,
        data.referenceId,
        data.amount,
        data.description ?? `Refund ${data.paymentId}`,
        data.createdBy,
      ],
      client
    );
  }

  async findById(
    paymentId: string,
    tenantId?: string,
    client?: PoolClient
  ): Promise<PaymentRecord | null> {
    const params: unknown[] = [paymentId];
    let whereClause = "WHERE payment.id = $1";

    if (tenantId) {
      params.push(tenantId);
      whereClause += ` AND payment.tenant_id = $${params.length}`;
    }

    const result = await this.query<PaymentRecord>(
      `${this.buildBaseQuery()}
      ${whereClause}
      LIMIT 1`,
      params,
      client
    );
    return result.rows[0] ?? null;
  }

  async list(filters: {
    tenantId: string;
    branchId?: string;
    branchIds?: string[];
    paymentMethodId?: string;
    cashSessionId?: string;
    referenceType?: PaymentReferenceType;
    referenceId?: string;
    direction?: string;
    status?: string;
    createdBy?: string;
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [filters.tenantId];
    const where: string[] = ["payment.tenant_id = $1"];

    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`payment.branch_id = $${params.length}`);
    } else if ((filters.branchIds?.length ?? 0) > 0) {
      params.push(filters.branchIds);
      where.push(`payment.branch_id = ANY($${params.length}::uuid[])`);
    }

    if (filters.paymentMethodId) {
      params.push(filters.paymentMethodId);
      where.push(`payment.payment_method_id = $${params.length}`);
    }

    if (filters.cashSessionId) {
      params.push(filters.cashSessionId);
      where.push(`payment.cash_session_id = $${params.length}`);
    }

    if (filters.referenceType) {
      params.push(filters.referenceType);
      where.push(`payment.reference_type = $${params.length}`);
    }

    if (filters.referenceId) {
      params.push(filters.referenceId);
      where.push(`payment.reference_id = $${params.length}`);
    }

    if (filters.direction) {
      params.push(filters.direction);
      where.push(`payment.direction = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`payment.status = $${params.length}`);
    }

    if (filters.createdBy) {
      params.push(filters.createdBy);
      where.push(`payment.created_by = $${params.length}`);
    }

    params.push(filters.limit);
    params.push(filters.offset);

    const result = await this.query<PaymentRecord>(
      `${this.buildBaseQuery()}
      WHERE ${where.join(" AND ")}
      ORDER BY payment.created_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}`,
      params
    );
    return result.rows ?? [];
  }

  async summarizeByPaymentMethodForCashSession(
    tenantId: string,
    cashSessionId: string,
    client?: PoolClient
  ) {
    const result = await this.query<PaymentMethodSummaryRecord>(
      `SELECT
        payment.payment_method_id,
        COALESCE(NULLIF(TRIM(method.nombre), ''), NULLIF(TRIM(method.codigo), ''), method.tipo) AS payment_method,
        method.codigo AS payment_method_codigo,
        method.nombre AS payment_method_nombre,
        method.tipo AS payment_method_tipo,
        COUNT(*)::text AS count,
        COALESCE(SUM(payment.amount), 0)::text AS total
      FROM payments AS payment
      INNER JOIN payment_methods AS method
        ON method.id = payment.payment_method_id
       AND method.tenant_id = payment.tenant_id
      WHERE payment.tenant_id = $1
        AND payment.cash_session_id = $2
        AND payment.status = 'COMPLETED'
      GROUP BY
        payment.payment_method_id,
        method.codigo,
        method.nombre,
        method.tipo
      ORDER BY payment_method ASC`,
      [tenantId, cashSessionId],
      client
    );

    return result.rows ?? [];
  }

  async sumAllocatedForReference(
    tenantId: string,
    referenceType: PaymentReferenceType,
    referenceId: string,
    client?: PoolClient
  ) {
    const result = await this.query<{ allocated_amount: string }>(
      `SELECT COALESCE(SUM(allocation.allocated_amount), 0)::text AS allocated_amount
      FROM payment_allocations AS allocation
      INNER JOIN payments AS payment
        ON payment.id = allocation.payment_id
      WHERE payment.tenant_id = $1
        AND allocation.reference_type = $2
        AND allocation.reference_id = $3
        AND payment.status IN ('PENDING', 'COMPLETED')`,
      [tenantId, referenceType, referenceId],
      client
    );
    return Number(result.rows[0]?.allocated_amount ?? 0);
  }

  async findReferenceDocument(
    tenantId: string,
    referenceType: PaymentReferenceType,
    referenceId: string,
    client?: PoolClient
  ): Promise<PaymentDocumentRecord | null> {
    const supportedType = referenceType === "PURCHASE_ORDER" ? "PURCHASE" : referenceType;

    if (supportedType === "SALE") {
      const result = await this.query<PaymentDocumentRecord>(
        `SELECT
          s.id,
          s.tenant_id,
          s.branch_id,
          s.status,
          s.total::text AS total,
          CASE
            WHEN s.type = 'CASH' THEN s.total
            ELSE COALESCE(s.balance_due, s.balance)
          END::text AS balance
        FROM sales AS s
        WHERE s.id = $1 AND s.tenant_id = $2
        LIMIT 1`,
        [referenceId, tenantId],
        client
      );
      return result.rows[0] ?? null;
    }

    if (supportedType === "PURCHASE") {
      const result = await this.query<PaymentDocumentRecord>(
        `SELECT
          p.id,
          p.tenant_id,
          audit_context.branch_id::text AS branch_id,
          p.status,
          p.supplier_id AS party_id,
          p.total::text AS total,
          COALESCE(p.balance_due, p.balance)::text AS balance
        FROM purchases AS p
        LEFT JOIN LATERAL (
          SELECT NULLIF(ae.datos_despues->>'branchId', '')::uuid AS branch_id
          FROM auditoria_eventos AS ae
          WHERE ae.tenant_id = p.tenant_id
            AND ae.entidad = 'purchases'
            AND ae.entidad_id = p.id::text
            AND ae.accion = 'PURCHASE_CREATED'
          ORDER BY ae.created_at DESC, ae.id DESC
          LIMIT 1
        ) AS audit_context ON TRUE
        WHERE p.id = $1 AND p.tenant_id = $2
        LIMIT 1`,
        [referenceId, tenantId],
        client
      );
      return result.rows[0] ?? null;
    }

    if (supportedType === "SALES_ORDER") {
      const result = await this.query<PaymentDocumentRecord>(
        `SELECT
          o.id,
          o.tenant_id,
          audit_context.branch_id::text AS branch_id,
          o.status,
          o.customer_id AS party_id,
          o.total::text AS total,
          o.balance_due::text AS balance
        FROM orders AS o
        LEFT JOIN LATERAL (
          SELECT NULLIF(ae.datos_despues->>'branchId', '')::uuid AS branch_id
          FROM auditoria_eventos AS ae
          WHERE ae.tenant_id = o.tenant_id
            AND ae.entidad = 'orders'
            AND ae.entidad_id = o.id::text
            AND ae.accion IN ('ORDER_CREATED', 'ORDER_UPDATED')
          ORDER BY ae.created_at DESC, ae.id DESC
          LIMIT 1
        ) AS audit_context ON TRUE
        WHERE o.id = $1 AND o.tenant_id = $2
        LIMIT 1`,
        [referenceId, tenantId],
        client
      );
      return result.rows[0] ?? null;
    }

    return null;
  }

  async syncSaleFinancialState(
    client: PoolClient,
    saleId: string,
    tenantId: string
  ) {
    await this.query<QueryResultRow>(
      `UPDATE sales
      SET
        total_paid = COALESCE(payment_totals.total_paid, 0),
        balance_due = CASE
          WHEN sales.type = 'CASH' THEN 0
          ELSE GREATEST(sales.total - COALESCE(payment_totals.total_paid, 0), 0)
        END,
        balance = CASE
          WHEN sales.type = 'CASH' THEN 0
          ELSE GREATEST(sales.total - COALESCE(payment_totals.total_paid, 0), 0)
        END,
        payment_status = CASE
          WHEN COALESCE(payment_totals.total_paid, 0) <= 0 THEN 'PENDING'
          WHEN COALESCE(payment_totals.total_paid, 0) < sales.total THEN 'PARTIAL'
          WHEN COALESCE(payment_totals.total_paid, 0) = sales.total THEN 'PAID'
          ELSE 'OVERPAID'
        END
      FROM (
        SELECT COALESCE(
          SUM(
            CASE
              WHEN payment.direction = 'OUT' THEN -allocation.allocated_amount
              ELSE allocation.allocated_amount
            END
          ),
          0
        ) AS total_paid
        FROM payment_allocations AS allocation
        INNER JOIN payments AS payment
          ON payment.id = allocation.payment_id
        WHERE payment.tenant_id = $2
          AND allocation.reference_type = 'SALE'
          AND allocation.reference_id = $1
          AND payment.status IN ('PENDING', 'COMPLETED')
      ) AS payment_totals
      WHERE id = $1 AND tenant_id = $2`,
      [saleId, tenantId],
      client
    );
  }

  async syncPurchaseFinancialState(
    client: PoolClient,
    purchaseId: string,
    tenantId: string
  ) {
    await this.query<QueryResultRow>(
      `UPDATE purchases
      SET
        total_paid = COALESCE(payment_totals.total_paid, 0),
        balance_due = GREATEST(purchases.total - COALESCE(payment_totals.total_paid, 0), 0),
        balance = GREATEST(purchases.total - COALESCE(payment_totals.total_paid, 0), 0),
        payment_status = CASE
          WHEN COALESCE(payment_totals.total_paid, 0) <= 0 THEN 'PENDING'
          WHEN COALESCE(payment_totals.total_paid, 0) < purchases.total THEN 'PARTIAL'
          WHEN COALESCE(payment_totals.total_paid, 0) = purchases.total THEN 'PAID'
          ELSE 'OVERPAID'
        END
      FROM (
        SELECT COALESCE(SUM(allocation.allocated_amount), 0) AS total_paid
        FROM payment_allocations AS allocation
        INNER JOIN payments AS payment
          ON payment.id = allocation.payment_id
        WHERE payment.tenant_id = $2
          AND allocation.reference_type IN ('PURCHASE', 'PURCHASE_ORDER')
          AND allocation.reference_id = $1
          AND payment.status IN ('PENDING', 'COMPLETED')
      ) AS payment_totals
      WHERE id = $1 AND tenant_id = $2`,
      [purchaseId, tenantId],
      client
    );
  }

  async syncOrderFinancialState(
    client: PoolClient,
    orderId: string,
    tenantId: string
  ) {
    await this.query<QueryResultRow>(
      `SELECT *
       FROM finance_sync_order_financial_state($1::uuid, $2::uuid)`,
      [orderId, tenantId],
      client
    );
  }
}
