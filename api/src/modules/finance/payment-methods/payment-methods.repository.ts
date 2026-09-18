import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";

export type PaymentMethodRecord = {
  id: string;
  tenant_id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  requires_reference: boolean;
  allows_change: boolean;
  active: boolean;
  electronic_billing_enabled: boolean;
  electronic_payment_means_code: string | null;
  electronic_payment_means_id: string | null;
  created_at: string;
  updated_at: string;
};

type CreatePaymentMethodInput = {
  tenantId: string;
  codigo: string;
  nombre: string;
  tipo: string;
  requiresReference: boolean;
  allowsChange: boolean;
  active: boolean;
  electronicBillingEnabled: boolean;
  electronicPaymentMeansCode?: string | null;
  electronicPaymentMeansId?: string | null;
};

type UpdatePaymentMethodInput = Partial<CreatePaymentMethodInput>;

@Injectable()
export class PaymentMethodsRepository {
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
    paymentMethodId: string,
    tenantId?: string,
    client?: PoolClient
  ): Promise<PaymentMethodRecord | null> {
    const params: unknown[] = [paymentMethodId];
    let whereClause = "WHERE id = $1";

    if (tenantId) {
      params.push(tenantId);
      whereClause += ` AND tenant_id = $${params.length}`;
    }

    const result = await this.query<PaymentMethodRecord>(
      `SELECT
        id,
        tenant_id,
        codigo,
        nombre,
        tipo,
        requires_reference,
        allows_change,
        active,
        electronic_billing_enabled,
        electronic_payment_means_code,
        electronic_payment_means_id,
        created_at,
        updated_at
      FROM payment_methods
      ${whereClause}
      LIMIT 1`,
      params,
      client
    );
    return result.rows[0] ?? null;
  }

  async existsCode(
    tenantId: string,
    codigo: string,
    excludeId?: string,
    client?: PoolClient
  ) {
    const params: unknown[] = [tenantId, codigo.trim().toLowerCase()];
    let whereClause = `
      tenant_id = $1
      AND LOWER(codigo) = $2
    `;

    if (excludeId) {
      params.push(excludeId);
      whereClause += ` AND id <> $${params.length}`;
    }

    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM payment_methods
      WHERE ${whereClause}
      LIMIT 1`,
      params,
      client
    );
    return (result.rows?.length ?? 0) > 0;
  }

  async list(tenantId: string, active?: boolean): Promise<PaymentMethodRecord[]> {
    const params: unknown[] = [tenantId];
    let whereClause = "WHERE tenant_id = $1";

    if (typeof active === "boolean") {
      params.push(active);
      whereClause += ` AND active = $${params.length}`;
    }

    const result = await this.query<PaymentMethodRecord>(
      `SELECT
        id,
        tenant_id,
        codigo,
        nombre,
        tipo,
        requires_reference,
        allows_change,
        active,
        electronic_billing_enabled,
        electronic_payment_means_code,
        electronic_payment_means_id,
        created_at,
        updated_at
      FROM payment_methods
      ${whereClause}
      ORDER BY nombre ASC, created_at DESC`,
      params
    );
    return result.rows ?? [];
  }

  async create(
    client: PoolClient,
    data: CreatePaymentMethodInput
  ): Promise<PaymentMethodRecord | null> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO payment_methods (
        tenant_id,
        codigo,
        nombre,
        tipo,
        requires_reference,
        allows_change,
        active,
        electronic_billing_enabled,
        electronic_payment_means_code,
        electronic_payment_means_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        data.tenantId,
        data.codigo,
        data.nombre,
        data.tipo,
        data.requiresReference,
        data.allowsChange,
        data.active,
        data.electronicBillingEnabled,
        data.electronicPaymentMeansCode ?? null,
        data.electronicPaymentMeansId ?? null,
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
    paymentMethodId: string,
    data: UpdatePaymentMethodInput
  ): Promise<PaymentMethodRecord | null> {
    const updates: string[] = [];
    const params: unknown[] = [paymentMethodId];

    if (data.codigo !== undefined) {
      params.push(data.codigo);
      updates.push(`codigo = $${params.length}`);
    }
    if (data.nombre !== undefined) {
      params.push(data.nombre);
      updates.push(`nombre = $${params.length}`);
    }
    if (data.tipo !== undefined) {
      params.push(data.tipo);
      updates.push(`tipo = $${params.length}`);
    }
    if (data.requiresReference !== undefined) {
      params.push(data.requiresReference);
      updates.push(`requires_reference = $${params.length}`);
    }
    if (data.allowsChange !== undefined) {
      params.push(data.allowsChange);
      updates.push(`allows_change = $${params.length}`);
    }
    if (data.active !== undefined) {
      params.push(data.active);
      updates.push(`active = $${params.length}`);
    }
    if (data.electronicBillingEnabled !== undefined) {
      params.push(data.electronicBillingEnabled);
      updates.push(`electronic_billing_enabled = $${params.length}`);
    }
    if (data.electronicPaymentMeansCode !== undefined) {
      params.push(data.electronicPaymentMeansCode);
      updates.push(`electronic_payment_means_code = $${params.length}`);
    }
    if (data.electronicPaymentMeansId !== undefined) {
      params.push(data.electronicPaymentMeansId);
      updates.push(`electronic_payment_means_id = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.findById(paymentMethodId, undefined, client);
    }

    updates.push("updated_at = NOW()");

    const result = await this.query<{ id: string }>(
      `UPDATE payment_methods
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
}
