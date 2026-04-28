import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { UnitEntity, type UnitProps } from "../entities/unit.entity";

type UnitRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  name: string;
  abbreviation: string;
  is_active: boolean;
};

type CreateUnitData = UnitProps;

type UpdateUnitData = Partial<Pick<UnitProps, "name" | "abbreviation" | "isActive">>;

@Injectable()
export class UnitRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  private mapRowToEntity(row: UnitRow): UnitEntity {
    return UnitEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      abbreviation: row.abbreviation,
      isActive: row.is_active,
    });
  }

  async findAllByTenant(tenantId: string): Promise<UnitEntity[]> {
    const result = await this.db.query<UnitRow>(
      `
        SELECT
          id,
          tenant_id,
          name,
          abbreviation,
          is_active
        FROM units
        WHERE tenant_id = $1
        ORDER BY name ASC
      `,
      [tenantId]
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findById(id: string, tenantId: string): Promise<UnitEntity | null> {
    const result = await this.db.query<UnitRow>(
      `
        SELECT
          id,
          tenant_id,
          name,
          abbreviation,
          is_active
        FROM units
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async create(data: CreateUnitData): Promise<UnitEntity | null> {
    const result = await this.db.query<UnitRow>(
      `
        INSERT INTO units (
          id,
          tenant_id,
          name,
          abbreviation,
          is_active
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          tenant_id,
          name,
          abbreviation,
          is_active
      `,
      [data.id, data.tenantId, data.name, data.abbreviation, data.isActive ?? true]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateUnitData
  ): Promise<UnitEntity | null> {
    const result = await this.db.query<UnitRow>(
      `
        UPDATE units
        SET
          name = COALESCE($3, name),
          abbreviation = COALESCE($4, abbreviation),
          is_active = COALESCE($5, is_active)
        WHERE id = $1 AND tenant_id = $2
        RETURNING
          id,
          tenant_id,
          name,
          abbreviation,
          is_active
      `,
      [id, tenantId, data.name ?? null, data.abbreviation ?? null, data.isActive ?? null]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async softDelete(id: string, tenantId: string): Promise<UnitEntity | null> {
    const result = await this.db.query<UnitRow>(
      `
        UPDATE units
        SET
          is_active = FALSE
        WHERE id = $1 AND tenant_id = $2
        RETURNING
          id,
          tenant_id,
          name,
          abbreviation,
          is_active
      `,
      [id, tenantId]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }
}
