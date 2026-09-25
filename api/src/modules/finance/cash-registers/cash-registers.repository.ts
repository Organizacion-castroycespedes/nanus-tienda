import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";

export type CashRegisterRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_nombre: string | null;
  terminal_id: string | null;
  terminal_nombre: string | null;
  codigo: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

type CreateCashRegisterInput = {
  tenantId: string;
  branchId: string;
  terminalId?: string | null;
  codigo: string;
  nombre: string;
  activo: boolean;
};

type UpdateCashRegisterInput = Partial<CreateCashRegisterInput>;

@Injectable()
export class CashRegistersRepository {
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
      register.id,
      register.tenant_id,
      register.branch_id,
      branch.nombre AS branch_nombre,
      register.terminal_id,
      terminal.name AS terminal_nombre,
      register.codigo,
      register.nombre,
      register.activo,
      register.created_at,
      register.updated_at
    FROM cash_registers AS register
    INNER JOIN tenant_branches AS branch
      ON branch.id = register.branch_id
     AND branch.tenant_id = register.tenant_id
    LEFT JOIN terminals AS terminal
      ON terminal.id = register.terminal_id
     AND terminal.tenant_id = register.tenant_id`;
  }

  async findById(
    cashRegisterId: string,
    tenantId?: string,
    client?: PoolClient
  ): Promise<CashRegisterRecord | null> {
    const params: unknown[] = [cashRegisterId];
    let whereClause = "WHERE register.id = $1";

    if (tenantId) {
      params.push(tenantId);
      whereClause += ` AND register.tenant_id = $${params.length}`;
    }

    const result = await this.query<CashRegisterRecord>(
      `${this.buildBaseQuery()}
      ${whereClause}
      LIMIT 1`,
      params,
      client
    );
    return result.rows[0] ?? null;
  }

  async existsCode(
    tenantId: string,
    branchId: string,
    codigo: string,
    excludeId?: string,
    client?: PoolClient
  ) {
    const params: unknown[] = [tenantId, branchId, codigo.trim().toLowerCase()];
    let whereClause = `
      tenant_id = $1
      AND branch_id = $2
      AND LOWER(codigo) = $3
    `;

    if (excludeId) {
      params.push(excludeId);
      whereClause += ` AND id <> $${params.length}`;
    }

    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM cash_registers
      WHERE ${whereClause}
      LIMIT 1`,
      params,
      client
    );
    return (result.rows?.length ?? 0) > 0;
  }

  async existsTerminalAssociation(
    tenantId: string,
    terminalId: string,
    excludeId?: string,
    client?: PoolClient
  ) {
    const params: unknown[] = [tenantId, terminalId];
    let whereClause = `
      tenant_id = $1
      AND terminal_id = $2
    `;

    if (excludeId) {
      params.push(excludeId);
      whereClause += ` AND id <> $${params.length}`;
    }

    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM cash_registers
      WHERE ${whereClause}
      LIMIT 1`,
      params,
      client
    );
    return (result.rows?.length ?? 0) > 0;
  }

  async list(filters: {
    tenantId: string;
    branchIds?: string[];
    branchId?: string;
    activo?: boolean;
  }) {
    const params: unknown[] = [filters.tenantId];
    const where: string[] = ["register.tenant_id = $1"];

    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`register.branch_id = $${params.length}`);
    } else if ((filters.branchIds?.length ?? 0) > 0) {
      params.push(filters.branchIds);
      where.push(`register.branch_id = ANY($${params.length}::uuid[])`);
    }

    if (typeof filters.activo === "boolean") {
      params.push(filters.activo);
      where.push(`register.activo = $${params.length}`);
    }

    const result = await this.query<CashRegisterRecord>(
      `${this.buildBaseQuery()}
      WHERE ${where.join(" AND ")}
      ORDER BY branch.nombre ASC, register.nombre ASC`,
      params
    );
    return result.rows ?? [];
  }

  async create(client: PoolClient, data: CreateCashRegisterInput) {
    const result = await this.query<{ id: string }>(
      `INSERT INTO cash_registers (
        tenant_id,
        branch_id,
        terminal_id,
        codigo,
        nombre,
        activo
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [
        data.tenantId,
        data.branchId,
        data.terminalId ?? null,
        data.codigo,
        data.nombre,
        data.activo,
      ],
      client
    );
    const created = result.rows[0];
    if (!created) {
      return null;
    }
    return this.findById(created.id, undefined, client);
  }

  async update(
    client: PoolClient,
    cashRegisterId: string,
    data: UpdateCashRegisterInput
  ) {
    const updates: string[] = [];
    const params: unknown[] = [cashRegisterId];

    if (data.branchId !== undefined) {
      params.push(data.branchId);
      updates.push(`branch_id = $${params.length}`);
    }
    if (data.terminalId !== undefined) {
      params.push(data.terminalId);
      updates.push(`terminal_id = $${params.length}`);
    }
    if (data.codigo !== undefined) {
      params.push(data.codigo);
      updates.push(`codigo = $${params.length}`);
    }
    if (data.nombre !== undefined) {
      params.push(data.nombre);
      updates.push(`nombre = $${params.length}`);
    }
    if (data.activo !== undefined) {
      params.push(data.activo);
      updates.push(`activo = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.findById(cashRegisterId, undefined, client);
    }

    updates.push("updated_at = NOW()");

    const result = await this.query<{ id: string }>(
      `UPDATE cash_registers
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

  async listActiveAssignments(cashRegisterId: string) {
    const result = await this.query<{
      id: string;
      cash_register_id: string;
      user_id: string;
      user_email: string | null;
      assigned_by_user_id: string;
      assigned_at: string;
    }>(
      `SELECT
        assignment.id,
        assignment.cash_register_id,
        assignment.user_id,
        usr.email AS user_email,
        assignment.assigned_by_user_id,
        assignment.assigned_at
      FROM cash_register_user_assignments AS assignment
      INNER JOIN users AS usr
        ON usr.id = assignment.user_id
      WHERE assignment.cash_register_id = $1
        AND assignment.unassigned_at IS NULL
      ORDER BY assignment.assigned_at ASC`,
      [cashRegisterId]
    );
    return result.rows;
  }

  async assignUser(input: {
    cashRegisterId: string;
    userId: string;
    assignedByUserId: string;
  }) {
    const result = await this.query<{
      id: string;
      cash_register_id: string;
      user_id: string;
      assigned_by_user_id: string;
      assigned_at: string;
    }>(
      `INSERT INTO cash_register_user_assignments (
        cash_register_id,
        user_id,
        assigned_by_user_id
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        cash_register_id,
        user_id,
        assigned_by_user_id,
        assigned_at`,
      [input.cashRegisterId, input.userId, input.assignedByUserId]
    );
    return result.rows[0] ?? null;
  }

  async unassignUser(input: {
    cashRegisterId: string;
    userId: string;
    unassignedByUserId: string;
  }) {
    const result = await this.query<{
      id: string;
      cash_register_id: string;
      user_id: string;
      unassigned_by_user_id: string | null;
      unassigned_at: string | null;
    }>(
      `UPDATE cash_register_user_assignments
      SET
        unassigned_by_user_id = $3,
        unassigned_at = NOW()
      WHERE cash_register_id = $1
        AND user_id = $2
        AND unassigned_at IS NULL
      RETURNING
        id,
        cash_register_id,
        user_id,
        unassigned_by_user_id,
        unassigned_at`,
      [input.cashRegisterId, input.userId, input.unassignedByUserId]
    );
    return result.rows[0] ?? null;
  }
}
