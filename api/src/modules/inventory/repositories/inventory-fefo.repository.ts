import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import type { InventoryLotStatus } from "../entities/inventory-lot.entity";

export type InventoryFefoProductPolicy = {
  id: string;
  tenantId: string;
  requiresLot: boolean;
  requiresExpiration: boolean;
};

export type InventoryFefoEligibleBalance = {
  lotId: string;
  lotCode: string;
  expirationDate: Date | null;
  receivedAt: Date;
  locationId: string | null;
  quantityAvailable: number;
  status: InventoryLotStatus;
};

type ProductPolicyRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  requires_lot: boolean;
  requires_expiration: boolean;
};

type EligibleBalanceRow = QueryResultRow & {
  lot_id: string;
  lot_code: string;
  expiration_date: string | Date | null;
  received_at: string | Date;
  location_id: string | null;
  quantity_available: string | number;
  status: InventoryLotStatus;
};

@Injectable()
export class InventoryFefoRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private toNumber(value: string | number | null | undefined) {
    if (value == null) {
      return 0;
    }
    return typeof value === "number" ? value : Number(value);
  }

  private mapProductPolicy(row: ProductPolicyRow): InventoryFefoProductPolicy {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      requiresLot: row.requires_lot,
      requiresExpiration: row.requires_expiration,
    };
  }

  private mapEligibleBalance(row: EligibleBalanceRow): InventoryFefoEligibleBalance {
    return {
      lotId: row.lot_id,
      lotCode: row.lot_code,
      expirationDate: row.expiration_date
        ? new Date(row.expiration_date)
        : null,
      receivedAt: new Date(row.received_at),
      locationId: row.location_id,
      quantityAvailable: this.toNumber(row.quantity_available),
      status: row.status,
    };
  }

  async validateProductForTenant(tenantId: string, productId: string) {
    const result = await this.db.query<ProductPolicyRow>(
      `
      SELECT id, tenant_id, requires_lot, requires_expiration
      FROM products
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [productId, tenantId]
    );

    return result.rows[0] ? this.mapProductPolicy(result.rows[0]) : null;
  }

  async validateBranchForTenant(tenantId: string, branchId: string) {
    const result = await this.db.query<QueryResultRow>(
      `
      SELECT 1
      FROM tenant_branches
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [branchId, tenantId]
    );

    return (result.rows?.length ?? 0) > 0;
  }

  async validateLocationForTenantBranch(
    tenantId: string,
    branchId: string,
    locationId: string
  ) {
    const result = await this.db.query<QueryResultRow>(
      `
      SELECT 1
      FROM inventory_locations
      WHERE id = $1
        AND tenant_id = $2
        AND branch_id = $3
      LIMIT 1
      `,
      [locationId, tenantId, branchId]
    );

    return (result.rows?.length ?? 0) > 0;
  }

  async findEligibleBalances(
    tenantId: string,
    branchId: string,
    productId: string,
    locationId?: string | null
  ) {
    const params: unknown[] = [tenantId, branchId, productId];
    const locationFilter = locationId
      ? (params.push(locationId), `AND balance.location_id = $${params.length}`)
      : "";

    const result = await this.db.query<EligibleBalanceRow>(
      `
      SELECT
        lot.id AS lot_id,
        lot.lot_code,
        lot.expiration_date,
        lot.received_at,
        balance.location_id,
        balance.quantity_available,
        lot.status
      FROM inventory_lot_balances AS balance
      INNER JOIN inventory_lots AS lot
        ON lot.id = balance.lot_id
       AND lot.tenant_id = balance.tenant_id
       AND lot.branch_id = balance.branch_id
       AND lot.product_id = balance.product_id
      WHERE balance.tenant_id = $1
        AND balance.branch_id = $2
        AND balance.product_id = $3
        ${locationFilter}
        AND balance.quantity_available > 0
        AND lot.status NOT IN ('BLOCKED', 'CANCELLED', 'CONSUMED')
        AND (
          lot.expiration_date IS NULL
          OR lot.expiration_date >= CURRENT_DATE
        )
      ORDER BY
        lot.expiration_date ASC NULLS LAST,
        lot.received_at ASC,
        lot.lot_code ASC,
        lot.id ASC
      `,
      params
    );

    return result.rows.map((row) => this.mapEligibleBalance(row));
  }
}
