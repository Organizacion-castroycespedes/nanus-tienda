import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import {
  InventoryLotBalanceEntity,
  type InventoryLotBalanceProps,
} from "../entities/inventory-lot-balance.entity";
import type { InventoryLotStatus } from "../entities/inventory-lot.entity";

type InventoryLotBalanceRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  lot_id: string;
  location_id: string | null;
  quantity_on_hand: string | number;
  quantity_reserved: string | number;
  quantity_available: string | number;
  last_movement_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InventoryLotBalanceFilters = {
  branchId?: string;
  productId?: string;
  lotId?: string;
  locationId?: string | null;
  onlyAvailable?: boolean;
  onlyActiveLots?: boolean;
  expirationFrom?: Date;
  expirationTo?: Date;
};

export type InventoryLotReference = QueryResultRow & {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  status: InventoryLotStatus;
};

type InventoryLocationReference = QueryResultRow & {
  id: string;
  tenant_id: string;
  branch_id: string;
};

type CreateInventoryLotBalanceData = Omit<
  InventoryLotBalanceProps,
  "quantityAvailable"
>;

type QuantityUpdateData = {
  quantityOnHand?: number;
  quantityReserved?: number;
  lastMovementAt?: Date | null;
};

type BalanceLookupParams = {
  branchId: string;
  productId: string;
  lotId: string;
  locationId?: string | null;
};

type QuantityOperationParams = BalanceLookupParams & {
  quantity: number;
  lastMovementAt?: Date | null;
};

@Injectable()
export class InventoryLotBalanceRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private readonly selectColumns = `
    id,
    tenant_id,
    branch_id,
    product_id,
    lot_id,
    location_id,
    quantity_on_hand,
    quantity_reserved,
    quantity_available,
    last_movement_at,
    created_at,
    updated_at
  `;

  private readonly aliasedSelectColumns = `
    balance.id,
    balance.tenant_id,
    balance.branch_id,
    balance.product_id,
    balance.lot_id,
    balance.location_id,
    balance.quantity_on_hand,
    balance.quantity_reserved,
    balance.quantity_available,
    balance.last_movement_at,
    balance.created_at,
    balance.updated_at
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

  private toDateOnly(value: Date | null | undefined) {
    if (value === undefined || value === null) {
      return value ?? null;
    }
    return value.toISOString().slice(0, 10);
  }

  private locationClause(locationId: string | null | undefined) {
    return locationId ? "location_id = $5" : "location_id IS NULL";
  }

  private mapRowToEntity(row: InventoryLotBalanceRow) {
    return InventoryLotBalanceEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      productId: row.product_id,
      lotId: row.lot_id,
      locationId: row.location_id,
      quantityOnHand: Number(row.quantity_on_hand),
      quantityReserved: Number(row.quantity_reserved),
      quantityAvailable: Number(row.quantity_available),
      lastMovementAt: row.last_movement_at
        ? new Date(row.last_movement_at)
        : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findMany(
    tenantId: string,
    filters: InventoryLotBalanceFilters = {},
    client?: PoolClient
  ) {
    const params: unknown[] = [tenantId];
    const where = ["balance.tenant_id = $1"];

    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`balance.branch_id = $${params.length}`);
    }
    if (filters.productId) {
      params.push(filters.productId);
      where.push(`balance.product_id = $${params.length}`);
    }
    if (filters.lotId) {
      params.push(filters.lotId);
      where.push(`balance.lot_id = $${params.length}`);
    }
    if (filters.locationId !== undefined) {
      if (filters.locationId === null) {
        where.push("balance.location_id IS NULL");
      } else {
        params.push(filters.locationId);
        where.push(`balance.location_id = $${params.length}`);
      }
    }
    if (filters.onlyAvailable) {
      where.push("balance.quantity_available > 0");
    }
    if (filters.onlyActiveLots) {
      where.push("lot.status = 'ACTIVE'");
    }
    if (filters.expirationFrom) {
      params.push(this.toDateOnly(filters.expirationFrom));
      where.push(`lot.expiration_date >= $${params.length}`);
    }
    if (filters.expirationTo) {
      params.push(this.toDateOnly(filters.expirationTo));
      where.push(`lot.expiration_date <= $${params.length}`);
    }

    const result = await this.query<InventoryLotBalanceRow>(
      `
      SELECT
        ${this.aliasedSelectColumns}
      FROM inventory_lot_balances AS balance
      INNER JOIN inventory_lots AS lot
        ON lot.id = balance.lot_id
       AND lot.tenant_id = balance.tenant_id
      WHERE ${where.join("\n        AND ")}
      ORDER BY balance.branch_id ASC, balance.product_id ASC, lot.expiration_date ASC NULLS LAST, balance.created_at ASC
      `,
      params,
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findById(tenantId: string, balanceId: string, client?: PoolClient) {
    const result = await this.query<InventoryLotBalanceRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM inventory_lot_balances
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, balanceId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByLot(tenantId: string, lotId: string, client?: PoolClient) {
    const result = await this.query<InventoryLotBalanceRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM inventory_lot_balances
      WHERE tenant_id = $1 AND lot_id = $2
      ORDER BY location_id ASC NULLS FIRST, created_at ASC
      `,
      [tenantId, lotId],
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findByProductBranch(
    tenantId: string,
    branchId: string,
    productId: string,
    client?: PoolClient
  ) {
    const result = await this.query<InventoryLotBalanceRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM inventory_lot_balances
      WHERE tenant_id = $1 AND branch_id = $2 AND product_id = $3
      ORDER BY lot_id ASC, location_id ASC NULLS FIRST
      `,
      [tenantId, branchId, productId],
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findByLotLocation(
    tenantId: string,
    branchId: string,
    productId: string,
    lotId: string,
    locationId?: string | null,
    client?: PoolClient
  ) {
    const params: unknown[] = [tenantId, branchId, productId, lotId];
    if (locationId) {
      params.push(locationId);
    }

    const result = await this.query<InventoryLotBalanceRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM inventory_lot_balances
      WHERE tenant_id = $1
        AND branch_id = $2
        AND product_id = $3
        AND lot_id = $4
        AND ${this.locationClause(locationId)}
      LIMIT 1
      `,
      params,
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async create(data: CreateInventoryLotBalanceData, client?: PoolClient) {
    const result = await this.query<InventoryLotBalanceRow>(
      `
      INSERT INTO inventory_lot_balances (
        id,
        tenant_id,
        branch_id,
        product_id,
        lot_id,
        location_id,
        quantity_on_hand,
        quantity_reserved,
        last_movement_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11
      )
      RETURNING
        ${this.selectColumns}
      `,
      [
        data.id,
        data.tenantId,
        data.branchId,
        data.productId,
        data.lotId,
        data.locationId ?? null,
        data.quantityOnHand ?? 0,
        data.quantityReserved ?? 0,
        data.lastMovementAt ?? null,
        data.createdAt,
        data.updatedAt,
      ],
      client
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  async updateQuantities(
    tenantId: string,
    balanceId: string,
    quantities: QuantityUpdateData,
    client?: PoolClient
  ) {
    const updates: string[] = [];
    const params: unknown[] = [tenantId, balanceId];

    const addUpdate = (column: string, value: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (quantities.quantityOnHand !== undefined) {
      addUpdate("quantity_on_hand", quantities.quantityOnHand);
    }
    if (quantities.quantityReserved !== undefined) {
      addUpdate("quantity_reserved", quantities.quantityReserved);
    }
    if (quantities.lastMovementAt !== undefined) {
      addUpdate("last_movement_at", quantities.lastMovementAt);
    }

    if (updates.length === 0) {
      return this.findById(tenantId, balanceId, client);
    }

    const result = await this.query<InventoryLotBalanceRow>(
      `
      UPDATE inventory_lot_balances
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

  async incrementOnHand(
    tenantId: string,
    params: QuantityOperationParams,
    client?: PoolClient
  ) {
    const balance = await this.findByLotLocation(
      tenantId,
      params.branchId,
      params.productId,
      params.lotId,
      params.locationId,
      client
    );
    if (!balance) {
      return null;
    }

    return this.updateQuantities(
      tenantId,
      balance.id,
      {
        quantityOnHand: balance.quantityOnHand + params.quantity,
        lastMovementAt: params.lastMovementAt ?? new Date(),
      },
      client
    );
  }

  async decrementOnHand(
    tenantId: string,
    params: QuantityOperationParams,
    client?: PoolClient
  ) {
    const balance = await this.findByLotLocation(
      tenantId,
      params.branchId,
      params.productId,
      params.lotId,
      params.locationId,
      client
    );
    if (!balance) {
      return null;
    }

    return this.updateQuantities(
      tenantId,
      balance.id,
      {
        quantityOnHand: balance.quantityOnHand - params.quantity,
        lastMovementAt: params.lastMovementAt ?? new Date(),
      },
      client
    );
  }

  async reserve(
    tenantId: string,
    params: QuantityOperationParams,
    client?: PoolClient
  ) {
    const balance = await this.findByLotLocation(
      tenantId,
      params.branchId,
      params.productId,
      params.lotId,
      params.locationId,
      client
    );
    if (!balance) {
      return null;
    }

    return this.updateQuantities(
      tenantId,
      balance.id,
      {
        quantityReserved: balance.quantityReserved + params.quantity,
        lastMovementAt: params.lastMovementAt ?? balance.lastMovementAt,
      },
      client
    );
  }

  async releaseReservation(
    tenantId: string,
    params: QuantityOperationParams,
    client?: PoolClient
  ) {
    const balance = await this.findByLotLocation(
      tenantId,
      params.branchId,
      params.productId,
      params.lotId,
      params.locationId,
      client
    );
    if (!balance) {
      return null;
    }

    return this.updateQuantities(
      tenantId,
      balance.id,
      {
        quantityReserved: balance.quantityReserved - params.quantity,
        lastMovementAt: params.lastMovementAt ?? balance.lastMovementAt,
      },
      client
    );
  }

  async validateLotBelongsToTenant(
    tenantId: string,
    lotId: string,
    client?: PoolClient
  ): Promise<InventoryLotReference | null> {
    const result = await this.query<InventoryLotReference>(
      `
      SELECT id, tenant_id, branch_id, product_id, status
      FROM inventory_lots
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [lotId, tenantId],
      client
    );

    return result.rows[0] ?? null;
  }

  async validateLocationBelongsToTenantBranch(
    tenantId: string,
    branchId: string,
    locationId: string,
    client?: PoolClient
  ): Promise<InventoryLocationReference | null> {
    const result = await this.query<InventoryLocationReference>(
      `
      SELECT id, tenant_id, branch_id
      FROM inventory_locations
      WHERE id = $1 AND tenant_id = $2 AND branch_id = $3
      LIMIT 1
      `,
      [locationId, tenantId, branchId],
      client
    );

    return result.rows[0] ?? null;
  }
}
