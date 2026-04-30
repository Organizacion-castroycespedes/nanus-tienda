import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";

export type TerminalRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  tenant_name: string | null;
  branch_name: string | null;
  name: string;
  code: string;
  device_fingerprint: string | null;
  is_active: boolean;
  created_at: string;
};

type BranchRecord = {
  id: string;
  tenant_id: string;
  nombre: string;
};

type CreateTerminalInput = {
  tenantId: string;
  branchId: string;
  name: string;
  code: string;
  deviceFingerprint?: string;
  isActive?: boolean;
};

type UpdateTerminalInput = {
  branchId?: string;
  name?: string;
  code?: string;
  deviceFingerprint?: string | null;
};

@Injectable()
export class TerminalsRepository {
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

  async validateBranch(
    tenantId: string,
    branchId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM tenant_branches
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1`,
      [branchId, tenantId],
      client
    );
    return (result.rows?.length ?? 0) > 0;
  }

  async findBranchById(
    branchId: string,
    client?: PoolClient
  ): Promise<BranchRecord | null> {
    const result = await this.query<BranchRecord>(
      `SELECT id, tenant_id, nombre
      FROM tenant_branches
      WHERE id = $1
      LIMIT 1`,
      [branchId],
      client
    );
    return result.rows[0] ?? null;
  }

  async existsCodeInBranch(
    tenantId: string,
    branchId: string,
    code: string,
    excludeId?: string,
    client?: PoolClient
  ): Promise<boolean> {
    const params: unknown[] = [tenantId, branchId, code.trim().toLowerCase()];
    let whereClause = `
      tenant_id = $1
      AND branch_id = $2
      AND LOWER(code) = $3
    `;

    if (excludeId) {
      params.push(excludeId);
      whereClause += ` AND id <> $${params.length}`;
    }

    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM terminals
      WHERE ${whereClause}
      LIMIT 1`,
      params,
      client
    );
    return (result.rows?.length ?? 0) > 0;
  }

  async findById(
    terminalId: string,
    tenantId?: string,
    client?: PoolClient
  ): Promise<TerminalRecord | null> {
    if (tenantId) {
      const result = await this.query<TerminalRecord>(
        `SELECT
          terminal.id,
          terminal.tenant_id,
          tenant.nombre AS tenant_name,
          terminal.branch_id,
          branch.nombre AS branch_name,
          terminal.name,
          terminal.code,
          terminal.device_fingerprint,
          terminal.is_active,
          terminal.created_at
        FROM terminals
        AS terminal
        LEFT JOIN tenants AS tenant
          ON tenant.id = terminal.tenant_id
        LEFT JOIN tenant_branches AS branch
          ON branch.id = terminal.branch_id
         AND branch.tenant_id = terminal.tenant_id
        WHERE terminal.id = $1 AND terminal.tenant_id = $2`,
        [terminalId, tenantId],
        client
      );
      return result.rows[0] ?? null;
    }

    const result = await this.query<TerminalRecord>(
      `SELECT
        terminal.id,
        terminal.tenant_id,
        tenant.nombre AS tenant_name,
        terminal.branch_id,
        branch.nombre AS branch_name,
        terminal.name,
        terminal.code,
        terminal.device_fingerprint,
        terminal.is_active,
        terminal.created_at
      FROM terminals AS terminal
      LEFT JOIN tenants AS tenant
        ON tenant.id = terminal.tenant_id
      LEFT JOIN tenant_branches AS branch
        ON branch.id = terminal.branch_id
       AND branch.tenant_id = terminal.tenant_id
      WHERE terminal.id = $1`,
      [terminalId],
      client
    );
    return result.rows[0] ?? null;
  }

  async createTerminal(
    client: PoolClient | undefined,
    data: CreateTerminalInput
  ): Promise<TerminalRecord | null> {
    const result = await this.query<TerminalRecord>(
      `INSERT INTO terminals (
        tenant_id,
        branch_id,
        name,
        code,
        device_fingerprint,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [
        data.tenantId,
        data.branchId,
        data.name,
        data.code,
        data.deviceFingerprint ?? null,
        data.isActive ?? true,
      ],
      client
    );
    const created = result.rows[0];
    if (!created) {
      return null;
    }
    return this.findById(created.id, undefined, client);
  }

  async findByBranch(
    tenantId: string,
    branchId?: string
  ): Promise<TerminalRecord[]> {
    const params: unknown[] = [tenantId];
    let whereClause = "WHERE terminal.tenant_id = $1";

    if (branchId) {
      params.push(branchId);
      whereClause += ` AND terminal.branch_id = $${params.length}`;
    }

    const result = await this.query<TerminalRecord>(
      `SELECT
        terminal.id,
        terminal.tenant_id,
        tenant.nombre AS tenant_name,
        terminal.branch_id,
        branch.nombre AS branch_name,
        terminal.name,
        terminal.code,
        terminal.device_fingerprint,
        terminal.is_active,
        terminal.created_at
      FROM terminals AS terminal
      LEFT JOIN tenants AS tenant
        ON tenant.id = terminal.tenant_id
      LEFT JOIN tenant_branches AS branch
        ON branch.id = terminal.branch_id
       AND branch.tenant_id = terminal.tenant_id
      ${whereClause}
      ORDER BY terminal.created_at DESC`,
      params
    );
    return result.rows ?? [];
  }

  async updateTerminal(
    client: PoolClient | undefined,
    id: string,
    data: UpdateTerminalInput
  ): Promise<TerminalRecord | null> {
    const updates: string[] = [];
    const params: unknown[] = [id];

    if (data.branchId !== undefined) {
      params.push(data.branchId);
      updates.push(`branch_id = $${params.length}`);
    }
    if (data.name !== undefined) {
      params.push(data.name);
      updates.push(`name = $${params.length}`);
    }
    if (data.code !== undefined) {
      params.push(data.code);
      updates.push(`code = $${params.length}`);
    }
    if (data.deviceFingerprint !== undefined) {
      params.push(data.deviceFingerprint);
      updates.push(`device_fingerprint = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.findById(id, undefined, client);
    }

    const result = await this.query<TerminalRecord>(
      `UPDATE terminals
      SET ${updates.join(", ")}
      WHERE id = $1
      RETURNING id`,
      params,
      client
    );
    const updated = result.rows[0];
    if (!updated) {
      return null;
    }
    return this.findById(updated.id, undefined, client);
  }

  async updateStatus(
    client: PoolClient | undefined,
    id: string,
    isActive: boolean
  ): Promise<TerminalRecord | null> {
    const result = await this.query<TerminalRecord>(
      `UPDATE terminals
      SET is_active = $2
      WHERE id = $1
      RETURNING id`,
      [id, isActive],
      client
    );
    const updated = result.rows[0];
    if (!updated) {
      return null;
    }
    return this.findById(updated.id, undefined, client);
  }
}
