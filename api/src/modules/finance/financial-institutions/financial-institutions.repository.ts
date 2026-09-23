import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";

export type FinancialInstitutionRecord = {
  id: string;
  tenant_id: string | null;
  codigo: string;
  nombre: string;
  nombre_corto: string | null;
  tipo: string;
  logo_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CreateFinancialInstitutionInput = {
  tenantId?: string | null;
  codigo: string;
  nombre: string;
  nombreCorto?: string | null;
  tipo: string;
  logoUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
};

export type UpdateFinancialInstitutionInput = Partial<CreateFinancialInstitutionInput>;

@Injectable()
export class FinancialInstitutionsRepository {
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

  async findById(
    id: string,
    tenantId?: string,
    client?: PoolClient
  ): Promise<FinancialInstitutionRecord | null> {
    const params: unknown[] = [id];
    let whereClause = "WHERE id = $1";

    if (tenantId) {
      params.push(tenantId);
      whereClause += ` AND (tenant_id = $${params.length} OR tenant_id IS NULL)`;
    }

    const result = await this.query<FinancialInstitutionRecord>(
      `SELECT
        id, tenant_id, codigo, nombre, nombre_corto, tipo, logo_url, active,
        COALESCE(sort_order, 0) AS sort_order, created_at, updated_at
      FROM financial_institutions
      ${whereClause}
      LIMIT 1`,
      params,
      client
    );
    return result.rows[0] ?? null;
  }

  async list(tenantId: string, paymentMethodId?: string, active?: boolean): Promise<FinancialInstitutionRecord[]> {
    const params: unknown[] = [tenantId];
    let queryText = `
      SELECT DISTINCT
        fi.id, fi.tenant_id, fi.codigo, fi.nombre, fi.nombre_corto, fi.tipo, fi.logo_url, fi.active,
        COALESCE(fi.sort_order, 0) AS sort_order, fi.created_at, fi.updated_at
      FROM financial_institutions fi
    `;

    if (paymentMethodId) {
      params.push(paymentMethodId);
      queryText += `
        INNER JOIN payment_method_financial_institutions pmfi 
          ON pmfi.financial_institution_id = fi.id
        WHERE (fi.tenant_id = $1 OR fi.tenant_id IS NULL)
          AND pmfi.tenant_id = $1
          AND pmfi.payment_method_id = $2
          AND pmfi.active = TRUE
      `;
    } else {
      queryText += ` WHERE (fi.tenant_id = $1 OR fi.tenant_id IS NULL)`;
    }

    if (typeof active === "boolean") {
      params.push(active);
      queryText += ` AND fi.active = $${params.length}`;
    }

    queryText += ` ORDER BY COALESCE(fi.sort_order, 0) ASC, fi.nombre ASC`;

    const result = await this.query<FinancialInstitutionRecord>(queryText, params);
    return result.rows ?? [];
  }

  async create(
    client: PoolClient,
    data: CreateFinancialInstitutionInput
  ): Promise<FinancialInstitutionRecord | null> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO financial_institutions (
        tenant_id, codigo, nombre, nombre_corto, tipo, logo_url, active, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        data.tenantId ?? null,
        data.codigo,
        data.nombre,
        data.nombreCorto ?? null,
        data.tipo,
        data.logoUrl ?? null,
        data.active ?? true,
        data.sortOrder ?? 0,
      ],
      client
    );

    const created = result.rows[0];
    if (!created) return null;
    return this.findById(created.id, undefined, client);
  }

  async update(
    client: PoolClient,
    id: string,
    data: UpdateFinancialInstitutionInput
  ): Promise<FinancialInstitutionRecord | null> {
    const updates: string[] = [];
    const params: unknown[] = [id];

    if (data.codigo !== undefined) {
      params.push(data.codigo);
      updates.push(`codigo = $${params.length}`);
    }
    if (data.nombre !== undefined) {
      params.push(data.nombre);
      updates.push(`nombre = $${params.length}`);
    }
    if (data.nombreCorto !== undefined) {
      params.push(data.nombreCorto);
      updates.push(`nombre_corto = $${params.length}`);
    }
    if (data.tipo !== undefined) {
      params.push(data.tipo);
      updates.push(`tipo = $${params.length}`);
    }
    if (data.logoUrl !== undefined) {
      params.push(data.logoUrl);
      updates.push(`logo_url = $${params.length}`);
    }
    if (data.active !== undefined) {
      params.push(data.active);
      updates.push(`active = $${params.length}`);
    }
    if (data.sortOrder !== undefined) {
      params.push(data.sortOrder);
      updates.push(`sort_order = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.findById(id, undefined, client);
    }

    updates.push("updated_at = NOW()");

    const result = await this.query<{ id: string }>(
      `UPDATE financial_institutions SET ${updates.join(", ")} WHERE id = $1 RETURNING id`,
      params,
      client
    );
    const updated = result.rows[0];
    if (!updated) return null;
    return this.findById(id, undefined, client);
  }

  async setPaymentMethodMappings(
    client: PoolClient,
    tenantId: string,
    paymentMethodId: string,
    financialInstitutionIds: string[]
  ) {
    // Delete existing mappings
    await this.query(
      `DELETE FROM payment_method_financial_institutions WHERE tenant_id = $1 AND payment_method_id = $2`,
      [tenantId, paymentMethodId],
      client
    );

    // Insert new mappings
    for (let i = 0; i < financialInstitutionIds.length; i++) {
      await this.query(
        `INSERT INTO payment_method_financial_institutions (
           tenant_id, payment_method_id, financial_institution_id, active, sort_order
         )
         VALUES ($1, $2, $3, TRUE, $4)
         ON CONFLICT (tenant_id, payment_method_id, financial_institution_id)
         DO UPDATE SET active = TRUE, sort_order = EXCLUDED.sort_order`,
        [tenantId, paymentMethodId, financialInstitutionIds[i], i],
        client
      );
    }
  }
}
