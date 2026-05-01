import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../../common/db/database.service";

export type FinanceBranchRecord = {
  id: string;
  tenant_id: string;
  nombre: string;
  codigo: string;
  estado: string;
};

export type FinanceTerminalRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  code: string;
  is_active: boolean;
};

export type FinanceUserRecord = {
  id: string;
  tenant_id: string;
  email: string;
  estado: string;
};

export type FinancePersonRecord = {
  id: string;
  tenant_id: string;
  nombres: string | null;
  apellidos: string | null;
};

@Injectable()
export class FinanceAccessRepository {
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

  async findBranchById(
    branchId: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<FinanceBranchRecord | null> {
    const result = await this.query<FinanceBranchRecord>(
      `SELECT id, tenant_id, nombre, codigo, estado
      FROM tenant_branches
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1`,
      [branchId, tenantId],
      client
    );
    return result.rows[0] ?? null;
  }

  async findTerminalById(
    terminalId: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<FinanceTerminalRecord | null> {
    const result = await this.query<FinanceTerminalRecord>(
      `SELECT id, tenant_id, branch_id, name, code, is_active
      FROM terminals
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1`,
      [terminalId, tenantId],
      client
    );
    return result.rows[0] ?? null;
  }

  async findUserById(
    userId: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<FinanceUserRecord | null> {
    const result = await this.query<FinanceUserRecord>(
      `SELECT id, tenant_id, email, estado
      FROM users
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1`,
      [userId, tenantId],
      client
    );
    return result.rows[0] ?? null;
  }

  async findPersonById(
    personId: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<FinancePersonRecord | null> {
    const result = await this.query<FinancePersonRecord>(
      `SELECT id, tenant_id, nombres, apellidos
      FROM personas
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1`,
      [personId, tenantId],
      client
    );
    return result.rows[0] ?? null;
  }

  async findAccessibleBranchIds(
    userId: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<string[]> {
    const result = await this.query<{ branch_id: string }>(
      `SELECT DISTINCT tb.id AS branch_id
      FROM users AS u
      INNER JOIN personas AS p
        ON p.id = u.persona_id
      INNER JOIN persona_tenant_branches AS ptb
        ON ptb.persona_id = p.id
       AND ptb.tenant_id = u.tenant_id
      INNER JOIN tenant_branches AS tb
        ON tb.id = ptb.tenant_branch_id
       AND tb.tenant_id = ptb.tenant_id
      WHERE u.id = $1
        AND u.tenant_id = $2
        AND u.estado = 'ACTIVE'
        AND tb.estado = 'ACTIVE'`,
      [userId, tenantId],
      client
    );
    return result.rows.map((row: { branch_id: string }) => row.branch_id);
  }

  async userHasBranchAccess(
    userId: string,
    tenantId: string,
    branchId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM users AS u
      INNER JOIN personas AS p
        ON p.id = u.persona_id
      INNER JOIN persona_tenant_branches AS ptb
        ON ptb.persona_id = p.id
       AND ptb.tenant_id = u.tenant_id
      WHERE u.id = $1
        AND u.tenant_id = $2
        AND u.estado = 'ACTIVE'
        AND ptb.tenant_branch_id = $3
      LIMIT 1`,
      [userId, tenantId, branchId],
      client
    );
    return (result.rows?.length ?? 0) > 0;
  }
}
