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
}
