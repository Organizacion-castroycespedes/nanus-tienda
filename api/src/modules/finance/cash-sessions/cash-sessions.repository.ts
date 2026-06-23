import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import type { CashSessionSummaryResponseDto } from "./dto/cash-session-summary-response.dto";

export type CashCountType = "AUDIT" | "CLOSING";

export type CashSessionRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  cash_register_id: string;
  cash_register_codigo: string | null;
  cash_register_nombre: string | null;
  opened_by_user_id: string;
  opened_by_user_email: string | null;
  closed_by_user_id: string | null;
  closed_by_user_email: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_amount: string;
  closing_amount: string | null;
  expected_amount: string | null;
  difference_amount: string | null;
  status: string;
  created_at: string;
};

type CreateCashSessionInput = {
  tenantId: string;
  branchId: string;
  cashRegisterId: string;
  openedByUserId: string;
  openingAmount: number;
};

type CloseCashSessionInput = {
  closedByUserId: string;
  closedAt: string;
  closingAmount: number;
  expectedAmount: number;
  differenceAmount: number;
  status: "CLOSED";
};

type CreateCashCountInput = {
  tenantId: string;
  branchId: string;
  cashSessionId: string;
  countedByUserId: string;
  countedAt: string;
  countedCashAmount: number;
  expectedAmount: number;
  differenceAmount: number;
  notes?: string | null;
  countType?: CashCountType;
  breakdownJson?: unknown;
};

export type CashCountRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  cash_session_id: string;
  counted_by_user_id: string;
  counted_by_user_email: string | null;
  counted_at: string;
  counted_cash_amount: string;
  expected_amount: string;
  difference_amount: string;
  notes: string | null;
  count_type: CashCountType;
  breakdown_json: unknown | null;
};

@Injectable()
export class CashSessionsRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

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
      session.id,
      session.tenant_id,
      session.branch_id,
      session.cash_register_id,
      register.codigo AS cash_register_codigo,
      register.nombre AS cash_register_nombre,
      session.opened_by_user_id,
      opened_user.email AS opened_by_user_email,
      session.closed_by_user_id,
      closed_user.email AS closed_by_user_email,
      session.opened_at,
      session.closed_at,
      session.opening_amount::text AS opening_amount,
      session.closing_amount::text AS closing_amount,
      session.expected_amount::text AS expected_amount,
      session.difference_amount::text AS difference_amount,
      session.status,
      session.created_at
    FROM cash_sessions AS session
    INNER JOIN cash_registers AS register
      ON register.id = session.cash_register_id
     AND register.tenant_id = session.tenant_id
    LEFT JOIN users AS opened_user
      ON opened_user.id = session.opened_by_user_id
     AND opened_user.tenant_id = session.tenant_id
    LEFT JOIN users AS closed_user
      ON closed_user.id = session.closed_by_user_id
     AND closed_user.tenant_id = session.tenant_id`;
  }

  async findById(
    cashSessionId: string,
    tenantId?: string,
    client?: PoolClient
  ): Promise<CashSessionRecord | null> {
    const params: unknown[] = [cashSessionId];
    let whereClause = "WHERE session.id = $1";

    if (tenantId) {
      params.push(tenantId);
      whereClause += ` AND session.tenant_id = $${params.length}`;
    }

    const result = await this.query<CashSessionRecord>(
      `${this.buildBaseQuery()}
      ${whereClause}
      LIMIT 1`,
      params,
      client
    );
    return result.rows[0] ?? null;
  }

  async findOpenByRegister(
    cashRegisterId: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<CashSessionRecord | null> {
    const result = await this.query<CashSessionRecord>(
      `${this.buildBaseQuery()}
      WHERE session.cash_register_id = $1
        AND session.tenant_id = $2
        AND session.status = 'OPEN'
      LIMIT 1`,
      [cashRegisterId, tenantId],
      client
    );
    return result.rows[0] ?? null;
  }

  async findCurrentByUser(
    userId: string,
    tenantId: string,
    cashRegisterId?: string
  ): Promise<CashSessionRecord | null> {
    const params: unknown[] = [userId, tenantId];
    let whereClause = `
      WHERE session.opened_by_user_id = $1
        AND session.tenant_id = $2
        AND session.status = 'OPEN'
    `;

    if (cashRegisterId) {
      params.push(cashRegisterId);
      whereClause += ` AND session.cash_register_id = $${params.length}`;
    }

    const result = await this.query<CashSessionRecord>(
      `${this.buildBaseQuery()}
      ${whereClause}
      ORDER BY session.opened_at DESC
      LIMIT 1`,
      params
    );
    return result.rows[0] ?? null;
  }

  async create(client: PoolClient, data: CreateCashSessionInput) {
    const result = await this.query<{ id: string }>(
      `INSERT INTO cash_sessions (
        tenant_id,
        branch_id,
        cash_register_id,
        opened_by_user_id,
        opened_at,
        opening_amount,
        status
      )
      VALUES ($1, $2, $3, $4, NOW(), $5, 'OPEN')
      RETURNING id`,
      [
        data.tenantId,
        data.branchId,
        data.cashRegisterId,
        data.openedByUserId,
        data.openingAmount,
      ],
      client
    );
    const created = result.rows[0];
    if (!created) {
      return null;
    }
    return this.findById(created.id, undefined, client);
  }

  async close(
    client: PoolClient,
    cashSessionId: string,
    data: CloseCashSessionInput
  ) {
    const result = await this.query<{ id: string }>(
      `UPDATE cash_sessions
      SET
        closed_by_user_id = $2,
        closed_at = $3,
        closing_amount = $4,
        expected_amount = $5,
        difference_amount = $6,
        status = $7
      WHERE id = $1
      RETURNING id`,
      [
        cashSessionId,
        data.closedByUserId,
        data.closedAt,
        data.closingAmount,
        data.expectedAmount,
        data.differenceAmount,
        data.status,
      ],
      client
    );
    const updated = result.rows[0];
    if (!updated) {
      return null;
    }
    return this.findById(updated.id, undefined, client);
  }

  async createCashCount(client: PoolClient, data: CreateCashCountInput) {
    const result = await this.query<CashCountRecord>(
      `INSERT INTO cash_counts (
        tenant_id,
        branch_id,
        cash_session_id,
        counted_by_user_id,
        counted_at,
        counted_cash_amount,
        expected_amount,
        difference_amount,
        notes,
        count_type,
        breakdown_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING
        id,
        tenant_id,
        branch_id,
        cash_session_id,
        counted_by_user_id,
        NULL::text AS counted_by_user_email,
        counted_at,
        counted_cash_amount::text AS counted_cash_amount,
        expected_amount::text AS expected_amount,
        difference_amount::text AS difference_amount,
        notes,
        count_type,
        breakdown_json`,
      [
        data.tenantId,
        data.branchId,
        data.cashSessionId,
        data.countedByUserId,
        data.countedAt,
        data.countedCashAmount,
        data.expectedAmount,
        data.differenceAmount,
        data.notes ?? null,
        data.countType ?? "CLOSING",
        data.breakdownJson === undefined ? null : JSON.stringify(data.breakdownJson),
      ],
      client
    );
    return result.rows[0] ?? null;
  }

  async listCashCounts(
    cashSessionId: string,
    tenantId: string,
    countType?: CashCountType
  ) {
    const params: unknown[] = [cashSessionId, tenantId];
    const where = [
      "count_data.cash_session_id = $1",
      "count_data.tenant_id = $2",
    ];

    if (countType) {
      params.push(countType);
      where.push(`count_data.count_type = $${params.length}`);
    }

    const result = await this.query<CashCountRecord>(
      `SELECT
        count_data.id,
        count_data.tenant_id,
        count_data.branch_id,
        count_data.cash_session_id,
        count_data.counted_by_user_id,
        counter.email AS counted_by_user_email,
        count_data.counted_at,
        count_data.counted_cash_amount::text AS counted_cash_amount,
        count_data.expected_amount::text AS expected_amount,
        count_data.difference_amount::text AS difference_amount,
        count_data.notes,
        count_data.count_type,
        count_data.breakdown_json
      FROM cash_counts AS count_data
      LEFT JOIN users AS counter
        ON counter.id = count_data.counted_by_user_id
       AND counter.tenant_id = count_data.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY count_data.counted_at DESC, count_data.id DESC`,
      params
    );

    return result.rows ?? [];
  }

  async getSummary(
    cashSessionId: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<CashSessionSummaryResponseDto | null> {
    const result = await this.query<{ summary: CashSessionSummaryResponseDto | null }>(
      `SELECT finance_cash_session_summary($1, $2) AS summary`,
      [tenantId, cashSessionId],
      client
    );

    return result.rows[0]?.summary ?? null;
  }

  async listHistory(filters: {
    tenantId: string;
    branchId?: string;
    branchIds?: string[];
    cashRegisterId?: string;
    status?: string;
    openedByUserId?: string;
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [filters.tenantId];
    const where: string[] = ["session.tenant_id = $1"];

    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`session.branch_id = $${params.length}`);
    } else if ((filters.branchIds?.length ?? 0) > 0) {
      params.push(filters.branchIds);
      where.push(`session.branch_id = ANY($${params.length}::uuid[])`);
    }

    if (filters.cashRegisterId) {
      params.push(filters.cashRegisterId);
      where.push(`session.cash_register_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`session.status = $${params.length}`);
    }

    if (filters.openedByUserId) {
      params.push(filters.openedByUserId);
      where.push(`session.opened_by_user_id = $${params.length}`);
    }

    params.push(filters.limit);
    params.push(filters.offset);

    const result = await this.query<CashSessionRecord>(
      `${this.buildBaseQuery()}
      WHERE ${where.join(" AND ")}
      ORDER BY session.opened_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}`,
      params
    );
    return result.rows ?? [];
  }
}
