import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";

export type PosUserSessionRecord = {
  id: string;
  auth_session_id: string;
  user_id: string;
  tenant_id: string;
  branch_id: string;
  terminal_id: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
};

export type AdminPosSessionRecord = PosUserSessionRecord & {
  user_email: string | null;
  user_display_name: string | null;
  terminal_code: string;
  terminal_name: string;
  branch_name: string | null;
  has_open_cash: boolean;
  pending_sales: number;
  pending_payments: number;
};

type AuthSessionValidationRecord = {
  id: string;
  user_id: string;
  tenant_id: string;
  is_active: boolean;
};

type ActiveAuthSessionRecord = {
  id: string;
};

type TerminalValidationRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  is_active: boolean;
};

type CreateSessionInput = {
  authSessionId: string;
  userId: string;
  tenantId: string;
  branchId: string;
  terminalId: string;
};

@Injectable()
export class PosUserSessionsRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient
  ) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query(text, params);
  }

  async findActiveByUser(
    userId: string,
    client?: PoolClient
  ): Promise<PosUserSessionRecord[]> {
    const result = await this.query<PosUserSessionRecord>(
      `SELECT
        id,
        auth_session_id,
        user_id,
        tenant_id,
        branch_id,
        terminal_id,
        started_at,
        ended_at,
        is_active
      FROM pos_user_sessions
      WHERE user_id = $1 AND is_active = TRUE
      ORDER BY started_at DESC`,
      [userId],
      client
    );
    return result.rows ?? [];
  }

  async findCurrentByUser(
    userId: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<PosUserSessionRecord | null> {
    const result = await this.query<PosUserSessionRecord>(
      `SELECT
        id,
        auth_session_id,
        user_id,
        tenant_id,
        branch_id,
        terminal_id,
        started_at,
        ended_at,
        is_active
      FROM pos_user_sessions
      WHERE user_id = $1 AND tenant_id = $2 AND is_active = TRUE
      ORDER BY started_at DESC
      LIMIT 1`,
      [userId, tenantId],
      client
    );
    return result.rows[0] ?? null;
  }

  async deactivateUserSessions(
    client: PoolClient | undefined,
    userId: string
  ) {
    await this.query(
      `UPDATE pos_user_sessions
      SET is_active = FALSE, ended_at = NOW()
      WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
      client
    );
  }

  async createSession(
    client: PoolClient | undefined,
    data: CreateSessionInput
  ): Promise<PosUserSessionRecord | null> {
    const result = await this.query<PosUserSessionRecord>(
      `INSERT INTO pos_user_sessions (
        auth_session_id,
        user_id,
        tenant_id,
        branch_id,
        terminal_id,
        started_at,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), TRUE)
      RETURNING
        id,
        auth_session_id,
        user_id,
        tenant_id,
        branch_id,
        terminal_id,
        started_at,
        ended_at,
        is_active`,
      [
        data.authSessionId,
        data.userId,
        data.tenantId,
        data.branchId,
        data.terminalId,
      ],
      client
    );
    return result.rows[0] ?? null;
  }

  async validateAuthSession(
    authSessionId: string,
    client?: PoolClient
  ): Promise<AuthSessionValidationRecord | null> {
    const result = await this.query<AuthSessionValidationRecord>(
      `SELECT id, user_id, tenant_id, is_active
      FROM auth_sessions
      WHERE id = $1`,
      [authSessionId],
      client
    );
    return result.rows[0] ?? null;
  }

  async findActiveAuthSessionByUser(
    userId: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<string | null> {
    const result = await this.query<ActiveAuthSessionRecord>(
      `SELECT id
      FROM auth_sessions
      WHERE user_id = $1 AND tenant_id = $2 AND is_active = TRUE
      ORDER BY created_at DESC
      LIMIT 1`,
      [userId, tenantId],
      client
    );
    return result.rows[0]?.id ?? null;
  }

  async validateTerminal(
    tenantId: string,
    branchId: string,
    terminalId: string,
    client?: PoolClient
  ): Promise<TerminalValidationRecord | null> {
    const result = await this.query<TerminalValidationRecord>(
      `SELECT id, tenant_id, branch_id, is_active
      FROM terminals
      WHERE id = $1 AND tenant_id = $2 AND branch_id = $3`,
      [terminalId, tenantId, branchId],
      client
    );
    return result.rows[0] ?? null;
  }

  async listActiveForTerminal(
    tenantId: string,
    branchId: string,
    terminalId: string,
    limit = 50,
    offset = 0,
    client?: PoolClient,
  ): Promise<AdminPosSessionRecord[]> {
    const result = await this.query<AdminPosSessionRecord>(
      `SELECT
        session.id,
        session.auth_session_id,
        session.user_id,
        session.tenant_id,
        session.branch_id,
        session.terminal_id,
        session.started_at,
        session.ended_at,
        session.is_active,
        users.email AS user_email,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', personas.nombres, personas.apellidos)), ''), users.email) AS user_display_name,
        terminal.code AS terminal_code,
        terminal.name AS terminal_name,
        branch.nombre AS branch_name,
        EXISTS (
          SELECT 1
          FROM cash_sessions AS cash
          INNER JOIN cash_registers AS register
            ON register.id = cash.cash_register_id
           AND register.tenant_id = cash.tenant_id
          WHERE cash.tenant_id = session.tenant_id
            AND cash.branch_id = session.branch_id
            AND register.terminal_id = session.terminal_id
            AND cash.status = 'OPEN'
        ) AS has_open_cash,
        (
          SELECT COUNT(*)::int
          FROM sales AS sale
          WHERE sale.tenant_id = session.tenant_id
            AND sale.branch_id = session.branch_id
            AND sale.terminal_id = session.terminal_id
            AND sale.pos_session_id = session.id
            AND sale.status NOT IN ('COMPLETED', 'CONFIRMED', 'CANCELLED', 'VOIDED')
        ) AS pending_sales,
        (
          SELECT COUNT(*)::int
          FROM payments AS payment
          WHERE payment.tenant_id = session.tenant_id
            AND payment.cash_session_id IN (
              SELECT cash.id
              FROM cash_sessions AS cash
              INNER JOIN cash_registers AS register
                ON register.id = cash.cash_register_id
               AND register.tenant_id = cash.tenant_id
              WHERE cash.tenant_id = session.tenant_id
                AND cash.branch_id = session.branch_id
                AND register.terminal_id = session.terminal_id
            )
            AND payment.status NOT IN ('COMPLETED', 'CANCELLED', 'VOIDED')
        ) AS pending_payments
      FROM pos_user_sessions AS session
      INNER JOIN terminals AS terminal
        ON terminal.id = session.terminal_id
       AND terminal.tenant_id = session.tenant_id
       AND terminal.branch_id = session.branch_id
      INNER JOIN tenant_branches AS branch
        ON branch.id = session.branch_id
       AND branch.tenant_id = session.tenant_id
      INNER JOIN users
        ON users.id = session.user_id
       AND users.tenant_id = session.tenant_id
      LEFT JOIN personas
        ON personas.id = users.persona_id
      WHERE session.tenant_id = $1
        AND session.branch_id = $2
        AND session.terminal_id = $3
        AND session.is_active = TRUE
      ORDER BY session.started_at ASC, session.id ASC
      LIMIT $4 OFFSET $5`,
      [tenantId, branchId, terminalId, limit, offset],
      client,
    );
    return result.rows ?? [];
  }

  async findActiveForAdmin(
    tenantId: string,
    branchId: string,
    terminalId: string,
    sessionId: string,
    client: PoolClient,
  ): Promise<AdminPosSessionRecord | null> {
    await client.query(
      `SELECT id
       FROM pos_user_sessions
       WHERE id = $1 AND tenant_id = $2 AND branch_id = $3
         AND terminal_id = $4 AND is_active = TRUE
       FOR UPDATE`,
      [sessionId, tenantId, branchId, terminalId],
    );
    const rows = await this.listActiveForTerminal(tenantId, branchId, terminalId, 100, 0, client);
    const row = rows.find((item) => item.id === sessionId);
    if (row) {
      return row;
    }

    const result = await client.query<AdminPosSessionRecord>(
      `SELECT
        session.id, session.auth_session_id, session.user_id, session.tenant_id,
        session.branch_id, session.terminal_id, session.started_at, session.ended_at,
        session.is_active, users.email AS user_email,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', personas.nombres, personas.apellidos)), ''), users.email) AS user_display_name,
        terminal.code AS terminal_code, terminal.name AS terminal_name,
        branch.nombre AS branch_name,
        FALSE AS has_open_cash, 0 AS pending_sales, 0 AS pending_payments
       FROM pos_user_sessions AS session
       INNER JOIN terminals AS terminal ON terminal.id = session.terminal_id AND terminal.tenant_id = session.tenant_id
       INNER JOIN tenant_branches AS branch ON branch.id = session.branch_id AND branch.tenant_id = session.tenant_id
       INNER JOIN users ON users.id = session.user_id AND users.tenant_id = session.tenant_id
       LEFT JOIN personas ON personas.id = users.persona_id
       WHERE session.id = $1 AND session.tenant_id = $2 AND session.branch_id = $3
         AND session.terminal_id = $4 AND session.is_active = TRUE
       FOR UPDATE`,
      [sessionId, tenantId, branchId, terminalId],
    );
    return result.rows[0] ?? null;
  }

  async getSafetyForSession(
    tenantId: string,
    branchId: string,
    terminalId: string,
    sessionId: string,
    client: PoolClient,
  ) {
    const result = await client.query<{ has_open_cash: boolean; pending_sales: number; pending_payments: number }>(
      `SELECT
        EXISTS (
          SELECT 1 FROM cash_sessions AS cash
          INNER JOIN cash_registers AS register ON register.id = cash.cash_register_id AND register.tenant_id = cash.tenant_id
          WHERE cash.tenant_id = $1 AND cash.branch_id = $2 AND register.terminal_id = $3 AND cash.status = 'OPEN'
        ) AS has_open_cash,
        (SELECT COUNT(*)::int FROM sales AS sale
          WHERE sale.tenant_id = $1 AND sale.branch_id = $2 AND sale.terminal_id = $3
            AND sale.pos_session_id = $4
            AND sale.status NOT IN ('COMPLETED', 'CONFIRMED', 'CANCELLED', 'VOIDED')) AS pending_sales,
        (SELECT COUNT(*)::int FROM payments AS payment
          WHERE payment.tenant_id = $1
            AND payment.cash_session_id IN (
              SELECT cash.id FROM cash_sessions AS cash
              INNER JOIN cash_registers AS register ON register.id = cash.cash_register_id AND register.tenant_id = cash.tenant_id
              WHERE cash.tenant_id = $1 AND cash.branch_id = $2 AND register.terminal_id = $3
            )
            AND payment.status NOT IN ('COMPLETED', 'CANCELLED', 'VOIDED')) AS pending_payments`,
      [tenantId, branchId, terminalId, sessionId],
    );
    return result.rows[0] ?? { has_open_cash: false, pending_sales: 0, pending_payments: 0 };
  }

  async closeOne(client: PoolClient, tenantId: string, terminalId: string, sessionId: string) {
    const result = await client.query<PosUserSessionRecord>(
      `UPDATE pos_user_sessions
       SET is_active = FALSE, ended_at = COALESCE(ended_at, NOW())
       WHERE id = $1 AND tenant_id = $2 AND terminal_id = $3 AND is_active = TRUE
       RETURNING id, auth_session_id, user_id, tenant_id, branch_id, terminal_id,
                 started_at, ended_at, is_active`,
      [sessionId, tenantId, terminalId],
    );
    return result.rows[0] ?? null;
  }
}
