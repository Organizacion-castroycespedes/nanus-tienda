import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";

export type ParameterRecord = {
  id: string;
  code: string;
  value_type: "MODE" | "BOOLEAN";
  default_value: string;
  active: boolean;
  label: string;
  created_at: string;
  updated_at: string;
};

export type TenantSettingRecord = {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  terminal_id: string | null;
  parameter_id: string;
  parameter_code: string;
  parameter_label: string;
  value: string;
  updated_by_user_id: string | null;
  updated_at: string;
};

export type ParameterMode = "DISABLED" | "ON_DEMAND" | "AUTOMATIC";

@Injectable()
export class ParametersRepository {
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

  async findTenantIdBySlug(slug: string): Promise<string | null> {
    const result = await this.query<{ id: string }>(
      `SELECT id
       FROM tenants
       WHERE slug = $1 AND activo = TRUE
       LIMIT 1`,
      [slug]
    );
    return result.rows[0]?.id ?? null;
  }

  async listParameters(includeInactive = false): Promise<ParameterRecord[]> {
    const result = await this.query<ParameterRecord>(
      `SELECT
        id,
        code,
        value_type,
        default_value,
        active,
        label,
        created_at,
        updated_at
      FROM parameters
      WHERE ($1::boolean = TRUE OR active = TRUE)
      ORDER BY code ASC`,
      [includeInactive]
    );
    return result.rows;
  }

  async findParameterById(parameterId: string): Promise<ParameterRecord | null> {
    const result = await this.query<ParameterRecord>(
      `SELECT
        id,
        code,
        value_type,
        default_value,
        active,
        label,
        created_at,
        updated_at
      FROM parameters
      WHERE id = $1`,
      [parameterId]
    );
    return result.rows[0] ?? null;
  }

  async findParameterByCode(code: string): Promise<ParameterRecord | null> {
    const result = await this.query<ParameterRecord>(
      `SELECT
        id,
        code,
        value_type,
        default_value,
        active,
        label,
        created_at,
        updated_at
      FROM parameters
      WHERE code = $1`,
      [code]
    );
    return result.rows[0] ?? null;
  }

  async createParameter(input: {
    code: string;
    valueType: "MODE" | "BOOLEAN";
    defaultValue: string;
    label: string;
    active: boolean;
  }): Promise<ParameterRecord> {
    const result = await this.query<ParameterRecord>(
      `INSERT INTO parameters (
        code,
        value_type,
        default_value,
        active,
        label
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        code,
        value_type,
        default_value,
        active,
        label,
        created_at,
        updated_at`,
      [input.code, input.valueType, input.defaultValue, input.active, input.label]
    );
    return result.rows[0];
  }

  async updateParameter(
    parameterId: string,
    input: {
      label?: string;
      defaultValue?: string;
      active?: boolean;
    }
  ): Promise<ParameterRecord | null> {
    const result = await this.query<ParameterRecord>(
      `UPDATE parameters
      SET
        label = COALESCE($2, label),
        default_value = COALESCE($3, default_value),
        active = COALESCE($4, active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        code,
        value_type,
        default_value,
        active,
        label,
        created_at,
        updated_at`,
      [
        parameterId,
        input.label ?? null,
        input.defaultValue ?? null,
        input.active ?? null,
      ]
    );
    return result.rows[0] ?? null;
  }

  async listTenantSettings(input: {
    tenantId: string;
    branchId?: string | null;
    terminalId?: string | null;
  }): Promise<TenantSettingRecord[]> {
    const params: unknown[] = [input.tenantId];
    const conditions = ["setting.tenant_id = $1"];

    if (input.branchId === null) {
      conditions.push("setting.branch_id IS NULL");
    } else if (input.branchId) {
      params.push(input.branchId);
      conditions.push(`setting.branch_id = $${params.length}`);
    }

    if (input.terminalId === null) {
      conditions.push("setting.terminal_id IS NULL");
    } else if (input.terminalId) {
      params.push(input.terminalId);
      conditions.push(`setting.terminal_id = $${params.length}`);
    }

    const result = await this.query<TenantSettingRecord>(
      `SELECT
        setting.id,
        setting.tenant_id,
        setting.branch_id,
        setting.terminal_id,
        setting.parameter_id,
        parameter.code AS parameter_code,
        parameter.label AS parameter_label,
        setting.value,
        setting.updated_by_user_id,
        setting.updated_at
      FROM tenant_settings AS setting
      INNER JOIN parameters AS parameter
        ON parameter.id = setting.parameter_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY parameter.code ASC`,
      params
    );
    return result.rows;
  }

  async upsertTenantSetting(input: {
    tenantId: string;
    branchId?: string | null;
    terminalId?: string | null;
    parameterId: string;
    value: string;
    updatedByUserId?: string | null;
  }): Promise<TenantSettingRecord> {
    const branchId = input.branchId ?? null;
    const terminalId = input.terminalId ?? null;

    const existing = await this.query<{ id: string }>(
      `SELECT id
       FROM tenant_settings
       WHERE tenant_id = $1
         AND parameter_id = $2
         AND branch_id IS NOT DISTINCT FROM $3::uuid
         AND terminal_id IS NOT DISTINCT FROM $4::uuid
       LIMIT 1`,
      [input.tenantId, input.parameterId, branchId, terminalId]
    );

    if (existing.rows[0]) {
      const updated = await this.query<TenantSettingRecord>(
        `UPDATE tenant_settings AS setting
         SET
           value = $2,
           updated_by_user_id = $3,
           updated_at = NOW()
         FROM parameters AS parameter
         WHERE setting.id = $1
           AND parameter.id = setting.parameter_id
         RETURNING
           setting.id,
           setting.tenant_id,
           setting.branch_id,
           setting.terminal_id,
           setting.parameter_id,
           parameter.code AS parameter_code,
           parameter.label AS parameter_label,
           setting.value,
           setting.updated_by_user_id,
           setting.updated_at`,
        [existing.rows[0].id, input.value, input.updatedByUserId ?? null]
      );
      return updated.rows[0];
    }

    const inserted = await this.query<TenantSettingRecord>(
      `INSERT INTO tenant_settings (
        tenant_id,
        branch_id,
        terminal_id,
        parameter_id,
        value,
        updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        tenant_id,
        branch_id,
        terminal_id,
        parameter_id,
        value,
        updated_by_user_id,
        updated_at`,
      [
        input.tenantId,
        branchId,
        terminalId,
        input.parameterId,
        input.value,
        input.updatedByUserId ?? null,
      ]
    );

    const parameter = await this.findParameterById(input.parameterId);
    return {
      ...inserted.rows[0],
      parameter_code: parameter?.code ?? "",
      parameter_label: parameter?.label ?? "",
    };
  }

  async resolveValue(
    code: string,
    tenantId: string,
    branchId?: string | null,
    terminalId?: string | null,
    client?: PoolClient
  ): Promise<string | null> {
    const result = await this.query<{ value: string | null }>(
      `SELECT public.resolve_parameter_value($1, $2, $3, $4) AS value`,
      [code, tenantId, branchId ?? null, terminalId ?? null],
      client
    );
    return result.rows[0]?.value ?? null;
  }
}
