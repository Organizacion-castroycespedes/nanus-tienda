import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import {
  InventoryLotEntity,
  type InventoryLotProps,
  type InventoryLotStatus,
} from "../entities/inventory-lot.entity";

type InventoryLotRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  supplier_id: string | null;
  purchase_id: string | null;
  purchase_item_id: string | null;
  lot_code: string;
  expiration_date: Date | string | null;
  received_at: Date | string;
  unit_cost: string | number;
  status: InventoryLotStatus;
  is_legacy: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InventoryLotFilters = {
  branchId?: string;
  branchIds?: string[];
  productId?: string;
  supplierId?: string;
  status?: InventoryLotStatus;
  isLegacy?: boolean;
  expirationFrom?: Date;
  expirationTo?: Date;
  search?: string;
};

export type ProductLotPolicy = {
  id: string;
  tenant_id: string;
  requires_expiration: boolean;
};

type CreateInventoryLotData = InventoryLotProps;

type UpdateInventoryLotData = Partial<
  Pick<
    InventoryLotProps,
    | "supplierId"
    | "purchaseId"
    | "purchaseItemId"
    | "lotCode"
    | "expirationDate"
    | "receivedAt"
    | "unitCost"
    | "status"
    | "isLegacy"
  >
>;

@Injectable()
export class InventoryLotRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private readonly selectColumns = `
    id,
    tenant_id,
    branch_id,
    product_id,
    supplier_id,
    purchase_id,
    purchase_item_id,
    lot_code,
    expiration_date,
    received_at,
    unit_cost,
    status,
    is_legacy,
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

  private toDateOnly(value: Date | null | undefined) {
    if (value === undefined || value === null) {
      return value ?? null;
    }
    return value.toISOString().slice(0, 10);
  }

  private mapRowToEntity(row: InventoryLotRow): InventoryLotEntity {
    return InventoryLotEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      productId: row.product_id,
      supplierId: row.supplier_id,
      purchaseId: row.purchase_id,
      purchaseItemId: row.purchase_item_id,
      lotCode: row.lot_code,
      expirationDate: row.expiration_date
        ? new Date(row.expiration_date)
        : null,
      receivedAt: new Date(row.received_at),
      unitCost: Number(row.unit_cost),
      status: row.status,
      isLegacy: row.is_legacy,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findMany(
    tenantId: string,
    filters: InventoryLotFilters = {},
    client?: PoolClient
  ): Promise<InventoryLotEntity[]> {
    const params: unknown[] = [tenantId];
    const where = ["tenant_id = $1"];

    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`branch_id = $${params.length}`);
    } else if ((filters.branchIds?.length ?? 0) > 0) {
      params.push(filters.branchIds);
      where.push(`branch_id = ANY($${params.length}::uuid[])`);
    }

    if (filters.productId) {
      params.push(filters.productId);
      where.push(`product_id = $${params.length}`);
    }

    if (filters.supplierId) {
      params.push(filters.supplierId);
      where.push(`supplier_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    if (filters.isLegacy !== undefined) {
      params.push(filters.isLegacy);
      where.push(`is_legacy = $${params.length}`);
    }

    if (filters.expirationFrom) {
      params.push(this.toDateOnly(filters.expirationFrom));
      where.push(`expiration_date >= $${params.length}`);
    }

    if (filters.expirationTo) {
      params.push(this.toDateOnly(filters.expirationTo));
      where.push(`expiration_date <= $${params.length}`);
    }

    const search = filters.search?.trim();
    if (search) {
      params.push(`%${search}%`);
      where.push(`lot_code ILIKE $${params.length}`);
    }

    const result = await this.query<InventoryLotRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM inventory_lots
      WHERE ${where.join("\n        AND ")}
      ORDER BY branch_id ASC, product_id ASC, expiration_date ASC NULLS LAST, received_at ASC
      `,
      params,
      client
    );

    return (result.rows ?? []).map((row) => this.mapRowToEntity(row));
  }

  async findById(
    tenantId: string,
    lotId: string,
    client?: PoolClient
  ): Promise<InventoryLotEntity | null> {
    const result = await this.query<InventoryLotRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM inventory_lots
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, lotId],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByCode(
    tenantId: string,
    branchId: string,
    productId: string,
    lotCode: string,
    client?: PoolClient
  ): Promise<InventoryLotEntity | null> {
    const result = await this.query<InventoryLotRow>(
      `
      SELECT
        ${this.selectColumns}
      FROM inventory_lots
      WHERE tenant_id = $1
        AND branch_id = $2
        AND product_id = $3
        AND UPPER(lot_code) = $4
      LIMIT 1
      `,
      [tenantId, branchId, productId, lotCode.trim().toUpperCase()],
      client
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async create(
    data: CreateInventoryLotData,
    client?: PoolClient
  ): Promise<InventoryLotEntity> {
    const result = await this.query<InventoryLotRow>(
      `
      INSERT INTO inventory_lots (
        id,
        tenant_id,
        branch_id,
        product_id,
        supplier_id,
        purchase_id,
        purchase_item_id,
        lot_code,
        expiration_date,
        received_at,
        unit_cost,
        status,
        is_legacy,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15
      )
      RETURNING
        ${this.selectColumns}
      `,
      [
        data.id,
        data.tenantId,
        data.branchId,
        data.productId,
        data.supplierId ?? null,
        data.purchaseId ?? null,
        data.purchaseItemId ?? null,
        data.lotCode,
        this.toDateOnly(data.expirationDate),
        data.receivedAt,
        data.unitCost ?? 0,
        data.status ?? "ACTIVE",
        data.isLegacy ?? false,
        data.createdAt,
        data.updatedAt,
      ],
      client
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  async update(
    tenantId: string,
    lotId: string,
    data: UpdateInventoryLotData,
    client?: PoolClient
  ): Promise<InventoryLotEntity | null> {
    const updates: string[] = [];
    const params: unknown[] = [tenantId, lotId];

    const addUpdate = (column: string, value: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (data.supplierId !== undefined) {
      addUpdate("supplier_id", data.supplierId);
    }
    if (data.purchaseId !== undefined) {
      addUpdate("purchase_id", data.purchaseId);
    }
    if (data.purchaseItemId !== undefined) {
      addUpdate("purchase_item_id", data.purchaseItemId);
    }
    if (data.lotCode !== undefined) {
      addUpdate("lot_code", data.lotCode);
    }
    if (data.expirationDate !== undefined) {
      addUpdate("expiration_date", this.toDateOnly(data.expirationDate));
    }
    if (data.receivedAt !== undefined) {
      addUpdate("received_at", data.receivedAt);
    }
    if (data.unitCost !== undefined) {
      addUpdate("unit_cost", data.unitCost);
    }
    if (data.status !== undefined) {
      addUpdate("status", data.status);
    }
    if (data.isLegacy !== undefined) {
      addUpdate("is_legacy", data.isLegacy);
    }

    if (updates.length === 0) {
      return this.findById(tenantId, lotId, client);
    }

    const result = await this.query<InventoryLotRow>(
      `
      UPDATE inventory_lots
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

  async updateStatus(
    tenantId: string,
    lotId: string,
    status: InventoryLotStatus,
    client?: PoolClient
  ): Promise<InventoryLotEntity | null> {
    return this.update(tenantId, lotId, { status }, client);
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

  async validateProductBelongsToTenant(
    tenantId: string,
    productId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `
      SELECT 1
      FROM products
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [productId, tenantId],
      client
    );

    return (result.rows?.length ?? 0) > 0;
  }

  async findProductLotPolicy(
    tenantId: string,
    productId: string,
    client?: PoolClient
  ): Promise<ProductLotPolicy | null> {
    const result = await this.query<ProductLotPolicy>(
      `
      SELECT id, tenant_id, requires_expiration
      FROM products
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [productId, tenantId],
      client
    );

    return result.rows[0] ?? null;
  }

  async validateSupplierBelongsToTenant(
    tenantId: string,
    supplierId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `
      SELECT 1
      FROM suppliers
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [supplierId, tenantId],
      client
    );

    return (result.rows?.length ?? 0) > 0;
  }

  async validatePurchaseBelongsToTenant(
    tenantId: string,
    purchaseId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `
      SELECT 1
      FROM purchases
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [purchaseId, tenantId],
      client
    );

    return (result.rows?.length ?? 0) > 0;
  }

  async validatePurchaseItemBelongsToTenant(
    tenantId: string,
    purchaseItemId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `
      SELECT 1
      FROM purchase_items AS item
      INNER JOIN purchases AS purchase
        ON purchase.id = item.purchase_id
      WHERE item.id = $1 AND purchase.tenant_id = $2
      LIMIT 1
      `,
      [purchaseItemId, tenantId],
      client
    );

    return (result.rows?.length ?? 0) > 0;
  }
}
