import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import {
  StockMovementLotEntity,
  type StockMovementLotProps,
} from "../entities/stock-movement-lot.entity";

type StockMovementLotRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  stock_movement_id: string;
  product_id: string;
  lot_id: string | null;
  location_id: string | null;
  quantity: string | number;
  created_at: Date | string;
};

export type StockMovementReference = QueryResultRow & {
  id: string;
  tenant_id: string;
  product_id: string;
  branch_id: string | null;
};

export type MovementLotReference = QueryResultRow & {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
};

type LocationReference = QueryResultRow & {
  id: string;
  tenant_id: string;
  branch_id: string;
};

type CreateStockMovementLotData = StockMovementLotProps;

type StockMovementLotProductFilters = {
  lotId?: string;
  locationId?: string;
};

@Injectable()
export class StockMovementLotRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private readonly selectColumns = `
    id,
    tenant_id,
    stock_movement_id,
    product_id,
    lot_id,
    location_id,
    quantity,
    created_at
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

  private mapRowToEntity(row: StockMovementLotRow) {
    return StockMovementLotEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      stockMovementId: row.stock_movement_id,
      productId: row.product_id,
      lotId: row.lot_id,
      locationId: row.location_id,
      quantity: Number(row.quantity),
      createdAt: new Date(row.created_at),
    });
  }

  async findByMovement(
    tenantId: string,
    stockMovementId: string,
    client?: PoolClient
  ) {
    const result = await this.query<StockMovementLotRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM stock_movement_lots
      WHERE tenant_id = $1 AND stock_movement_id = $2
      ORDER BY created_at ASC
      `,
      [tenantId, stockMovementId],
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findByLot(tenantId: string, lotId: string, client?: PoolClient) {
    const result = await this.query<StockMovementLotRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM stock_movement_lots
      WHERE tenant_id = $1 AND lot_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, lotId],
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findByProduct(
    tenantId: string,
    productId: string,
    filters: StockMovementLotProductFilters = {},
    client?: PoolClient
  ) {
    const params: unknown[] = [tenantId, productId];
    const where = ["tenant_id = $1", "product_id = $2"];

    if (filters.lotId) {
      params.push(filters.lotId);
      where.push(`lot_id = $${params.length}`);
    }
    if (filters.locationId) {
      params.push(filters.locationId);
      where.push(`location_id = $${params.length}`);
    }

    const result = await this.query<StockMovementLotRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM stock_movement_lots
      WHERE ${where.join("\n        AND ")}
      ORDER BY created_at DESC
      `,
      params,
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async create(data: CreateStockMovementLotData, client?: PoolClient) {
    const result = await this.query<StockMovementLotRow>(
      `
      INSERT INTO stock_movement_lots (
        id,
        tenant_id,
        stock_movement_id,
        product_id,
        lot_id,
        location_id,
        quantity,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING
        ${this.selectColumns}
      `,
      [
        data.id,
        data.tenantId,
        data.stockMovementId,
        data.productId,
        data.lotId ?? null,
        data.locationId ?? null,
        data.quantity,
        data.createdAt,
      ],
      client
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  async validateStockMovementBelongsToTenant(
    tenantId: string,
    stockMovementId: string,
    client?: PoolClient
  ): Promise<StockMovementReference | null> {
    const result = await this.query<StockMovementReference>(
      `
      SELECT id, tenant_id, product_id, branch_id
      FROM stock_movements
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [stockMovementId, tenantId],
      client
    );

    return result.rows[0] ?? null;
  }

  async validateLotBelongsToTenant(
    tenantId: string,
    lotId: string,
    client?: PoolClient
  ): Promise<MovementLotReference | null> {
    const result = await this.query<MovementLotReference>(
      `
      SELECT id, tenant_id, branch_id, product_id
      FROM inventory_lots
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [lotId, tenantId],
      client
    );

    return result.rows[0] ?? null;
  }

  async validateLocationBelongsToTenant(
    tenantId: string,
    locationId: string,
    client?: PoolClient
  ): Promise<LocationReference | null> {
    const result = await this.query<LocationReference>(
      `
      SELECT id, tenant_id, branch_id
      FROM inventory_locations
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [locationId, tenantId],
      client
    );

    return result.rows[0] ?? null;
  }
}
