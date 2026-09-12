import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { TaxEntity, type TaxProps } from "../entities/tax.entity";

type TaxRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  name: string;
  rate: string | number;
  is_included: boolean;
  is_active: boolean;
  tax_type_id: string | null;
  calculation_method_id: string | null;
  tax_base_type_id: string | null;
  tax_type_code: string | null;
  tax_type_dian_code: string | null;
  calculation_method_code: string | null;
  tax_base_type_code: string | null;
};

type CreateTaxData = TaxProps & {
  taxTypeId?: string | null;
  calculationMethodId?: string | null;
  taxBaseTypeId?: string | null;
};

type UpdateTaxData = Partial<
  Pick<
    TaxProps,
    | "name"
    | "rate"
    | "isIncluded"
    | "isActive"
    | "taxTypeId"
    | "calculationMethodId"
    | "taxBaseTypeId"
  >
>;

export type TaxCatalogItem = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  dianCode?: string | null;
  taxCategoryId?: string | null;
  isAlcoholicBeverage?: boolean;
};

export type TaxRateSeedData = {
  tenantId: string;
  taxId: string;
  calculationMethodId: string;
  taxBaseTypeId: string;
  percentageRate?: number | null;
  fixedAmount?: number | null;
  baseQuantity?: number | null;
  baseUnitCode?: string | null;
  taxProductCategoryId?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

const TAX_SELECT = `
  t.id,
  t.tenant_id,
  t.name,
  t.rate,
  t.is_included,
  t.is_active,
  t.tax_type_id,
  t.calculation_method_id,
  t.tax_base_type_id,
  tt.code AS tax_type_code,
  tt.dian_code AS tax_type_dian_code,
  cm.code AS calculation_method_code,
  bt.code AS tax_base_type_code
`;

@Injectable()
export class TaxRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

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

  private mapRowToEntity(row: TaxRow): TaxEntity {
    return TaxEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      rate: Number(row.rate),
      isIncluded: row.is_included,
      isActive: row.is_active,
      taxTypeId: row.tax_type_id,
      calculationMethodId: row.calculation_method_id,
      taxBaseTypeId: row.tax_base_type_id,
      taxTypeCode: row.tax_type_code,
      taxTypeDianCode: row.tax_type_dian_code,
      calculationMethodCode: row.calculation_method_code,
      taxBaseTypeCode: row.tax_base_type_code,
    });
  }

  async findAllByTenant(
    tenantId: string,
    client?: PoolClient
  ): Promise<TaxEntity[]> {
    const result = await this.query<TaxRow>(
      `
        SELECT
          ${TAX_SELECT}
        FROM taxes t
        LEFT JOIN tax_types tt ON tt.id = t.tax_type_id
        LEFT JOIN tax_calculation_methods cm ON cm.id = t.calculation_method_id
        LEFT JOIN tax_base_types bt ON bt.id = t.tax_base_type_id
        WHERE t.tenant_id = $1
        ORDER BY t.name ASC
      `,
      [tenantId],
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findById(
    id: string,
    tenantId: string,
    client?: PoolClient
  ): Promise<TaxEntity | null> {
    const result = await this.query<TaxRow>(
      `
        SELECT
          ${TAX_SELECT}
        FROM taxes t
        LEFT JOIN tax_types tt ON tt.id = t.tax_type_id
        LEFT JOIN tax_calculation_methods cm ON cm.id = t.calculation_method_id
        LEFT JOIN tax_base_types bt ON bt.id = t.tax_base_type_id
        WHERE t.id = $1 AND t.tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByIds(
    tenantId: string,
    ids: string[],
    client?: PoolClient
  ): Promise<TaxEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    const result = await this.query<TaxRow>(
      `
        SELECT
          ${TAX_SELECT}
        FROM taxes t
        LEFT JOIN tax_types tt ON tt.id = t.tax_type_id
        LEFT JOIN tax_calculation_methods cm ON cm.id = t.calculation_method_id
        LEFT JOIN tax_base_types bt ON bt.id = t.tax_base_type_id
        WHERE t.tenant_id = $1
          AND t.id = ANY($2::uuid[])
      `,
      [tenantId, ids],
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async create(
    data: CreateTaxData,
    client?: PoolClient
  ): Promise<TaxEntity | null> {
    const result = await this.query<TaxRow>(
      `
        INSERT INTO taxes (
          id,
          tenant_id,
          name,
          rate,
          is_included,
          is_active,
          tax_type_id,
          calculation_method_id,
          tax_base_type_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          tenant_id,
          name,
          rate,
          is_included,
          is_active,
          tax_type_id,
          calculation_method_id,
          tax_base_type_id
      `,
      [
        data.id,
        data.tenantId,
        data.name,
        data.rate,
        data.isIncluded,
        data.isActive ?? true,
        data.taxTypeId ?? null,
        data.calculationMethodId ?? null,
        data.taxBaseTypeId ?? null,
      ],
      client
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findById(result.rows[0].id, data.tenantId, client);
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateTaxData,
    client?: PoolClient
  ): Promise<TaxEntity | null> {
    const result = await this.query<TaxRow>(
      `
        UPDATE taxes
        SET
          name = COALESCE($3, name),
          rate = COALESCE($4, rate),
          is_included = COALESCE($5, is_included),
          is_active = COALESCE($6, is_active),
          tax_type_id = COALESCE($7, tax_type_id),
          calculation_method_id = COALESCE($8, calculation_method_id),
          tax_base_type_id = COALESCE($9, tax_base_type_id)
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
      `,
      [
        id,
        tenantId,
        data.name ?? null,
        data.rate ?? null,
        data.isIncluded ?? null,
        data.isActive ?? null,
        data.taxTypeId ?? null,
        data.calculationMethodId ?? null,
        data.taxBaseTypeId ?? null,
      ],
      client
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findById(id, tenantId, client);
  }

  async softDelete(id: string, tenantId: string): Promise<TaxEntity | null> {
    const result = await this.db.query<{ id: string }>(
      `
        UPDATE taxes
        SET
          is_active = FALSE
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
      `,
      [id, tenantId]
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findById(id, tenantId);
  }

  async listTaxTypes(): Promise<TaxCatalogItem[]> {
    const result = await this.db.query<
      QueryResultRow & {
        id: string;
        code: string;
        name: string;
        is_active: boolean;
        dian_code: string | null;
        tax_category_id: string;
      }
    >(
      `
        SELECT id, code, name, is_active, dian_code, tax_category_id
        FROM tax_types
        WHERE is_active = TRUE
        ORDER BY code ASC
      `
    );

    return (result.rows ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.is_active,
      dianCode: row.dian_code,
      taxCategoryId: row.tax_category_id,
    }));
  }

  async listCalculationMethods(): Promise<TaxCatalogItem[]> {
    const result = await this.db.query<
      QueryResultRow & {
        id: string;
        code: string;
        name: string;
        is_active: boolean;
      }
    >(
      `
        SELECT id, code, name, is_active
        FROM tax_calculation_methods
        WHERE is_active = TRUE
        ORDER BY code ASC
      `
    );

    return (result.rows ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.is_active,
    }));
  }

  async listBaseTypes(): Promise<TaxCatalogItem[]> {
    const result = await this.db.query<
      QueryResultRow & {
        id: string;
        code: string;
        name: string;
        is_active: boolean;
      }
    >(
      `
        SELECT id, code, name, is_active
        FROM tax_base_types
        WHERE is_active = TRUE
        ORDER BY code ASC
      `
    );

    return (result.rows ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.is_active,
    }));
  }

  async listProductCategories(): Promise<TaxCatalogItem[]> {
    const result = await this.db.query<
      QueryResultRow & {
        id: string;
        code: string;
        name: string;
        is_active: boolean;
        is_alcoholic_beverage: boolean;
      }
    >(
      `
        SELECT id, code, name, is_active, is_alcoholic_beverage
        FROM tax_product_categories
        WHERE is_active = TRUE
        ORDER BY code ASC
      `
    );

    return (result.rows ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.is_active,
      isAlcoholicBeverage: row.is_alcoholic_beverage,
    }));
  }

  async upsertTaxRate(
    data: TaxRateSeedData,
    client?: PoolClient
  ): Promise<void> {
    await this.query(
      `
        INSERT INTO tax_rates (
          tenant_id,
          tax_id,
          tax_product_category_id,
          calculation_method_id,
          tax_base_type_id,
          percentage_rate,
          fixed_amount,
          base_quantity,
          base_unit_code,
          effective_from,
          effective_to,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11::date, TRUE)
        ON CONFLICT ON CONSTRAINT uq_tax_rates_scope DO UPDATE
        SET
          calculation_method_id = EXCLUDED.calculation_method_id,
          tax_base_type_id = EXCLUDED.tax_base_type_id,
          percentage_rate = EXCLUDED.percentage_rate,
          fixed_amount = EXCLUDED.fixed_amount,
          base_quantity = EXCLUDED.base_quantity,
          base_unit_code = EXCLUDED.base_unit_code,
          effective_to = EXCLUDED.effective_to,
          is_active = TRUE,
          updated_at = now()
      `,
      [
        data.tenantId,
        data.taxId,
        data.taxProductCategoryId ?? null,
        data.calculationMethodId,
        data.taxBaseTypeId,
        data.percentageRate ?? null,
        data.fixedAmount ?? null,
        data.baseQuantity ?? null,
        data.baseUnitCode ?? null,
        data.effectiveFrom,
        data.effectiveTo ?? null,
      ],
      client
    );
  }
}
