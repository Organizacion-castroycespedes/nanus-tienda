import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { TaxEntity, type TaxProps } from "../entities/tax.entity";

type TaxRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  name: string;
  rate: string | number;
  is_included: boolean;
  is_active: boolean;
};

type CreateTaxData = TaxProps;

type UpdateTaxData = Partial<Pick<TaxProps, "name" | "rate" | "isIncluded">>;

@Injectable()
export class TaxRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  private mapRowToEntity(row: TaxRow): TaxEntity {
    return TaxEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      rate: Number(row.rate),
      isIncluded: row.is_included,
      isActive: row.is_active,
    });
  }

  async findAllByTenant(tenantId: string): Promise<TaxEntity[]> {
    const result = await this.db.query<TaxRow>(
      `
        SELECT
          id,
          tenant_id,
          name,
          rate,
          is_included,
          is_active
        FROM taxes
        WHERE tenant_id = $1
        ORDER BY name ASC
      `,
      [tenantId]
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findById(id: string, tenantId: string): Promise<TaxEntity | null> {
    const result = await this.db.query<TaxRow>(
      `
        SELECT
          id,
          tenant_id,
          name,
          rate,
          is_included,
          is_active
        FROM taxes
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async create(data: CreateTaxData): Promise<TaxEntity | null> {
    const result = await this.db.query<TaxRow>(
      `
        INSERT INTO taxes (
          id,
          tenant_id,
          name,
          rate,
          is_included,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          tenant_id,
          name,
          rate,
          is_included,
          is_active
      `,
      [data.id, data.tenantId, data.name, data.rate, data.isIncluded, data.isActive ?? true]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateTaxData
  ): Promise<TaxEntity | null> {
    const result = await this.db.query<TaxRow>(
      `
        UPDATE taxes
        SET
          name = COALESCE($3, name),
          rate = COALESCE($4, rate),
          is_included = COALESCE($5, is_included),
          is_active = COALESCE($6, is_active)
        WHERE id = $1 AND tenant_id = $2
        RETURNING
          id,
          tenant_id,
          name,
          rate,
          is_included,
          is_active
      `,
      [id, tenantId, data.name ?? null, data.rate ?? null, data.isIncluded ?? null, data.isActive ?? null]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async softDelete(id: string, tenantId: string): Promise<TaxEntity | null> {
    const result = await this.db.query<TaxRow>(
      `
        UPDATE taxes
        SET
          is_active = FALSE
        WHERE id = $1 AND tenant_id = $2
        RETURNING
          id,
          tenant_id,
          name,
          rate,
          is_included,
          is_active
      `,
      [id, tenantId]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }
}
