import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";

export type CashMovementRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  cash_session_id: string;
  payment_id: string | null;
  cash_register_id: string | null;
  cash_register_nombre: string | null;
  movement_type: string;
  direction: string;
  reference_type: string | null;
  reference_id: string | null;
  amount: string;
  description: string | null;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
};

type CreateCashMovementInput = {
  tenantId: string;
  branchId: string;
  cashSessionId: string;
  paymentId?: string | null;
  movementType: string;
  direction: string;
  referenceType?: string | null;
  referenceId?: string | null;
  amount: number;
  description?: string | null;
  createdBy: string;
};

@Injectable()
export class CashMovementsRepository {
  private paymentIdColumnExists: boolean | null = null;

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

  private async hasPaymentIdColumn(client?: PoolClient) {
    if (this.paymentIdColumnExists !== null) {
      return this.paymentIdColumnExists;
    }

    const result = await this.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'cash_movements'
          AND column_name = 'payment_id'
      ) AS exists`,
      [],
      client
    );

    this.paymentIdColumnExists = Boolean(result.rows[0]?.exists);
    return this.paymentIdColumnExists;
  }

  private async buildBaseQuery(client?: PoolClient) {
    const paymentIdSelect = (await this.hasPaymentIdColumn(client))
      ? "movement.payment_id"
      : "NULL::uuid AS payment_id";

    return `SELECT
      movement.id,
      movement.tenant_id,
      movement.branch_id,
      movement.cash_session_id,
      ${paymentIdSelect},
      session.cash_register_id,
      register.nombre AS cash_register_nombre,
      movement.movement_type,
      movement.direction,
      movement.reference_type,
      movement.reference_id,
      movement.amount::text AS amount,
      movement.description,
      movement.created_by,
      creator.email AS created_by_email,
      movement.created_at
    FROM cash_movements AS movement
    INNER JOIN cash_sessions AS session
      ON session.id = movement.cash_session_id
     AND session.tenant_id = movement.tenant_id
    INNER JOIN cash_registers AS register
      ON register.id = session.cash_register_id
     AND register.tenant_id = movement.tenant_id
    LEFT JOIN users AS creator
      ON creator.id = movement.created_by
     AND creator.tenant_id = movement.tenant_id`;
  }

  async create(client: PoolClient, data: CreateCashMovementInput) {
    const hasPaymentIdColumn = await this.hasPaymentIdColumn(client);
    const paymentIdColumn = hasPaymentIdColumn ? "payment_id," : "";
    const paymentIdValue = hasPaymentIdColumn ? "$4," : "";
    const paymentIdParam = hasPaymentIdColumn ? [data.paymentId ?? null] : [];
    const movementTypeParamIndex = hasPaymentIdColumn ? 5 : 4;
    const directionParamIndex = hasPaymentIdColumn ? 6 : 5;
    const referenceTypeParamIndex = hasPaymentIdColumn ? 7 : 6;
    const referenceIdParamIndex = hasPaymentIdColumn ? 8 : 7;
    const amountParamIndex = hasPaymentIdColumn ? 9 : 8;
    const descriptionParamIndex = hasPaymentIdColumn ? 10 : 9;
    const createdByParamIndex = hasPaymentIdColumn ? 11 : 10;

    const result = await this.query<{ id: string }>(
      `INSERT INTO cash_movements (
        tenant_id,
        branch_id,
        cash_session_id,
        ${paymentIdColumn}
        movement_type,
        direction,
        reference_type,
        reference_id,
        amount,
        description,
        created_by
      )
      VALUES (
        $1, $2, $3,
        ${paymentIdValue}
        $${movementTypeParamIndex},
        $${directionParamIndex},
        $${referenceTypeParamIndex},
        $${referenceIdParamIndex},
        $${amountParamIndex},
        $${descriptionParamIndex},
        $${createdByParamIndex}
      )
      RETURNING id`,
      [
        data.tenantId,
        data.branchId,
        data.cashSessionId,
        ...paymentIdParam,
        data.movementType,
        data.direction,
        data.referenceType ?? null,
        data.referenceId ?? null,
        data.amount,
        data.description ?? null,
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

  async syncPaymentMovementReference(
    client: PoolClient,
    paymentId: string,
    data: {
      referenceType: string;
      referenceId: string;
    }
  ) {
    if (!(await this.hasPaymentIdColumn(client))) {
      return;
    }

    await this.query<QueryResultRow>(
      `UPDATE cash_movements
       SET
         reference_type = $2,
         reference_id = $3
       WHERE payment_id = $1
         AND movement_type = 'PAYMENT'`,
      [paymentId, data.referenceType, data.referenceId],
      client
    );
  }

  async findById(
    movementId: string,
    tenantId?: string,
    client?: PoolClient
  ): Promise<CashMovementRecord | null> {
    const params: unknown[] = [movementId];
    let whereClause = "WHERE movement.id = $1";

    if (tenantId) {
      params.push(tenantId);
      whereClause += ` AND movement.tenant_id = $${params.length}`;
    }

    const baseQuery = await this.buildBaseQuery(client);
    const result = await this.query<CashMovementRecord>(
      `${baseQuery}
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
    cashRegisterId?: string;
    cashSessionId?: string;
    movementType?: string;
    direction?: string;
    createdBy?: string;
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [filters.tenantId];
    const where: string[] = ["movement.tenant_id = $1"];

    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`movement.branch_id = $${params.length}`);
    } else if ((filters.branchIds?.length ?? 0) > 0) {
      params.push(filters.branchIds);
      where.push(`movement.branch_id = ANY($${params.length}::uuid[])`);
    }

    if (filters.cashRegisterId) {
      params.push(filters.cashRegisterId);
      where.push(`session.cash_register_id = $${params.length}`);
    }

    if (filters.cashSessionId) {
      params.push(filters.cashSessionId);
      where.push(`movement.cash_session_id = $${params.length}`);
    }

    if (filters.movementType) {
      params.push(filters.movementType);
      where.push(`movement.movement_type = $${params.length}`);
    }

    if (filters.direction) {
      params.push(filters.direction);
      where.push(`movement.direction = $${params.length}`);
    }

    if (filters.createdBy) {
      params.push(filters.createdBy);
      where.push(`movement.created_by = $${params.length}`);
    }

    params.push(filters.limit);
    params.push(filters.offset);

    const baseQuery = await this.buildBaseQuery();
    const result = await this.query<CashMovementRecord>(
      `${baseQuery}
      WHERE ${where.join(" AND ")}
      ORDER BY movement.created_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}`,
      params
    );
    return result.rows ?? [];
  }

  async calculateSessionExpectedAmount(
    cashSessionId: string,
    client?: PoolClient
  ): Promise<number> {
    const result = await this.query<{ expected_amount: string }>(
      `SELECT COALESCE(
        SUM(
          CASE
            WHEN direction = 'IN' THEN amount
            ELSE -amount
          END
        ),
        0
      )::text AS expected_amount
      FROM cash_movements
      WHERE cash_session_id = $1
        AND movement_type <> 'CLOSING'`,
      [cashSessionId],
      client
    );

    return Number(result.rows[0]?.expected_amount ?? 0);
  }
}
