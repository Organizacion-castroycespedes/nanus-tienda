import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import {
  InventoryLocationEntity,
  type InventoryLocationProps,
  type InventoryLocationType,
} from "../entities/inventory-location.entity";

type InventoryLocationRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  branch_id: string;
  code: string;
  name: string;
  type: InventoryLocationType;
  description: string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InventoryLocationFilters = {
  type?: InventoryLocationType;
  isActive?: boolean;
  search?: string;
  branchIds?: string[];
};

type CreateInventoryLocationData = InventoryLocationProps;

type UpdateInventoryLocationData = Partial<
  Pick<
    InventoryLocationProps,
    "code" | "name" | "type" | "description" | "isActive"
  >
>;

@Injectable()
export class InventoryLocationRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private readonly selectColumns = `
    id,
    tenant_id,
    branch_id,
    code,
    name,
    type,
    description,
    is_active,
    created_at,
    updated_at
  `;

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

  private mapRowToEntity(row: InventoryLocationRow): InventoryLocationEntity {
    return InventoryLocationEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      code: row.code,
      name: row.name,
      type: row.type,
      description: row.description,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findByTenantAndBranch(
    tenantId: string,
    branchId?: string,
    filters: InventoryLocationFilters = {},
    client?: PoolClient
  ): Promise<InventoryLocationEntity[]> {
    const params: unknown[] = [tenantId];
    const where = ["tenant_id = $1"];

    if (branchId) {
      params.push(branchId);
      where.push(`branch_id = $${params.length}`);
    } else if ((filters.branchIds?.length ?? 0) > 0) {
      params.push(filters.branchIds);
      where.push(`branch_id = ANY($${params.length}::uuid[])`);
    }

    if (filters.type) {
      params.push(filters.type);
      where.push(`type = $${params.length}`);
    }

    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      where.push(`is_active = $${params.length}`);
    }

    const search = filters.search?.trim();
    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(code ILIKE $${params.length} OR name ILIKE $${params.length})`
      );
    }

    const result = await this.query<InventoryLocationRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM inventory_locations
      WHERE ${where.join("\n        AND ")}
      ORDER BY branch_id ASC, code ASC
      `,
      params,
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findById(
    tenantId: string,
    locationId: string,
    client?: PoolClient
  ): Promise<InventoryLocationEntity | null> {
    const result = await this.query<InventoryLocationRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM inventory_locations
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, locationId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByCode(
    tenantId: string,
    branchId: string,
    code: string,
    client?: PoolClient
  ): Promise<InventoryLocationEntity | null> {
    const result = await this.query<InventoryLocationRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM inventory_locations
      WHERE tenant_id = $1
        AND branch_id = $2
        AND UPPER(code) = $3
      LIMIT 1
      `,
      [tenantId, branchId, code.trim().toUpperCase()],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async create(
    data: CreateInventoryLocationData,
    client?: PoolClient
  ): Promise<InventoryLocationEntity> {
    const result = await this.query<InventoryLocationRow>(
      `
      INSERT INTO inventory_locations (
        id,
        tenant_id,
        branch_id,
        code,
        name,
        type,
        description,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      RETURNING
        ${this.selectColumns}
      `,
      [
        data.id,
        data.tenantId,
        data.branchId,
        data.code,
        data.name,
        data.type ?? "OTHER",
        data.description ?? null,
        data.isActive ?? true,
        data.createdAt,
        data.updatedAt,
      ],
      client
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  async update(
    tenantId: string,
    locationId: string,
    data: UpdateInventoryLocationData,
    client?: PoolClient
  ): Promise<InventoryLocationEntity | null> {
    const updates: string[] = [];
    const params: unknown[] = [tenantId, locationId];

    const addUpdate = (column: string, value: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (data.code !== undefined) {
      addUpdate("code", data.code);
    }
    if (data.name !== undefined) {
      addUpdate("name", data.name);
    }
    if (data.type !== undefined) {
      addUpdate("type", data.type);
    }
    if (data.description !== undefined) {
      addUpdate("description", data.description);
    }
    if (data.isActive !== undefined) {
      addUpdate("is_active", data.isActive);
    }

    if (updates.length === 0) {
      return this.findById(tenantId, locationId, client);
    }

    const result = await this.query<InventoryLocationRow>(
      `
      UPDATE inventory_locations
      SET
        ${updates.join(",\n        ")},
        updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING
        ${this.selectColumns}
      `,
      params,
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async deactivate(
    tenantId: string,
    locationId: string,
    client?: PoolClient
  ): Promise<InventoryLocationEntity | null> {
    return this.update(
      tenantId,
      locationId,
      {
        isActive: false,
      },
      client
    );
  }

  async validateBranchBelongsToTenant(
    tenantId: string,
    branchId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `
      SELECT 1
      FROM tenant_branches
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [branchId, tenantId],
      client
    );

    return (result.rows?.length ?? 0) > 0;
  }
}
