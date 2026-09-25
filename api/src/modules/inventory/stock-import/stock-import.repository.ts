import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { STOCK_IMPORT_REFERENCE_TABLE } from "./stock-import.columns";
import type {
  StockImportCatalogs,
  StockImportLotStatus,
} from "./stock-import.resolver";

type Queryable = PoolClient;

export const STOCK_IMPORT_WRITE_CHUNK = 500;

export type StockImportMovementInsert = {
  id: string;
  productId: string;
  branchId: string;
  type: "IN" | "OUT";
  quantity: number;
  stockBefore: number;
  stockAfter: number;
};

export type StockImportLotInsert = {
  id: string;
  productId: string;
  branchId: string;
  lotCode: string;
  expirationDate: string | null;
  unitCost: number;
};

export type StockImportBalanceUpsert = {
  productId: string;
  branchId: string;
  lotId: string;
  locationId: string | null;
  quantityOnHand: number;
};

export type StockImportMovementLotInsert = {
  stockMovementId: string;
  productId: string;
  lotId: string;
  locationId: string | null;
  quantity: number;
};

export type StockImportTemplateProduct = {
  id: string;
  sku: string;
  name: string;
  requiresLot: boolean;
  stock: number;
};

export type StockImportTemplateLot = {
  productId: string;
  lotCode: string;
  expirationDate: string | null;
  onHand: number;
};

function chunk<T>(items: T[], size = STOCK_IMPORT_WRITE_CHUNK) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

@Injectable()
export class StockImportRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  private run<T extends QueryResultRow>(
    client: Queryable | undefined,
    text: string,
    params: unknown[]
  ): Promise<{ rows: T[] }> {
    return client ? client.query<T>(text, params) : this.db.query<T>(text, params);
  }

  async listBranches(tenantId: string): Promise<StockImportCatalogs["branches"]> {
    const result = await this.db.query<{
      id: string;
      codigo: string;
      nombre: string;
      estado: string | null;
    }>(
      `
        SELECT id, codigo, nombre, estado
        FROM tenant_branches
        WHERE tenant_id = $1
        ORDER BY es_principal DESC, nombre ASC
      `,
      [tenantId]
    );
    return (result.rows ?? []).map((row) => ({
      id: row.id,
      code: row.codigo,
      name: row.nombre,
      isActive: (row.estado ?? "ACTIVE").toUpperCase() === "ACTIVE",
    }));
  }

  async findProducts(
    tenantId: string,
    keys: { ids: string[]; skus: string[]; barcodes: string[] },
    client?: Queryable
  ): Promise<Pick<StockImportCatalogs, "products" | "barcodes">> {
    if (keys.ids.length === 0 && keys.skus.length === 0 && keys.barcodes.length === 0) {
      return { products: [], barcodes: [] };
    }

    const barcodes = keys.barcodes.length
      ? await this.run<{ barcode: string; product_id: string }>(
          client,
          `
            SELECT barcode, product_id
            FROM product_barcodes
            WHERE tenant_id = $1
              AND is_active = TRUE
              AND barcode = ANY($2::text[])
          `,
          [tenantId, keys.barcodes]
        )
      : { rows: [] };
    const barcodeProductIds = (barcodes.rows ?? []).map((row) => row.product_id);

    const products = await this.run<{
      id: string;
      sku: string;
      name: string;
      is_active: boolean | null;
      requires_lot: boolean | null;
      requires_expiration: boolean | null;
      cost: string | number | null;
    }>(
      client,
      `
        SELECT id, sku, name, is_active, requires_lot, requires_expiration, cost
        FROM products
        WHERE tenant_id = $1
          AND (
            id = ANY($2::uuid[])
            OR UPPER(BTRIM(sku)) = ANY($3::text[])
          )
      `,
      [tenantId, [...new Set([...keys.ids, ...barcodeProductIds])], keys.skus]
    );

    return {
      products: (products.rows ?? []).map((row) => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        isActive: row.is_active !== false,
        requiresLot: Boolean(row.requires_lot),
        requiresExpiration: Boolean(row.requires_expiration),
        cost: row.cost == null ? 0 : Number(row.cost),
      })),
      barcodes: (barcodes.rows ?? []).map((row) => ({
        barcode: row.barcode,
        productId: row.product_id,
      })),
    };
  }

  async currentStock(
    tenantId: string,
    productIds: string[],
    client?: Queryable
  ): Promise<StockImportCatalogs["currentStock"]> {
    if (productIds.length === 0) {
      return [];
    }
    const result = await this.run<{
      product_id: string;
      branch_id: string;
      stock: string | number;
    }>(
      client,
      `
        SELECT
          product_id,
          branch_id,
          COALESCE(SUM(quantity) FILTER (WHERE type = 'IN'), 0)
            - COALESCE(SUM(quantity) FILTER (WHERE type = 'OUT'), 0) AS stock
        FROM stock_movements
        WHERE tenant_id = $1
          AND product_id = ANY($2::uuid[])
          AND branch_id IS NOT NULL
        GROUP BY product_id, branch_id
      `,
      [tenantId, productIds]
    );
    return (result.rows ?? []).map((row) => ({
      productId: row.product_id,
      branchId: row.branch_id,
      quantity: Number(row.stock),
    }));
  }

  async listLots(
    tenantId: string,
    productIds: string[],
    client?: Queryable
  ): Promise<StockImportCatalogs["lots"]> {
    if (productIds.length === 0) {
      return [];
    }
    const result = await this.run<{
      id: string;
      product_id: string;
      branch_id: string;
      lot_code: string;
      expiration_date: string | null;
      status: StockImportLotStatus;
      on_hand: string | number;
      reserved: string | number;
      balance_count: string | number;
      location_id: string | null;
    }>(
      client,
      `
        SELECT
          l.id,
          l.product_id,
          l.branch_id,
          l.lot_code,
          TO_CHAR(l.expiration_date, 'YYYY-MM-DD') AS expiration_date,
          l.status,
          COALESCE(SUM(b.quantity_on_hand), 0) AS on_hand,
          COALESCE(SUM(b.quantity_reserved), 0) AS reserved,
          COUNT(b.id) AS balance_count,
          (ARRAY_AGG(b.location_id))[1] AS location_id
        FROM inventory_lots l
        LEFT JOIN inventory_lot_balances b
          ON b.lot_id = l.id
         AND b.tenant_id = l.tenant_id
        WHERE l.tenant_id = $1
          AND l.product_id = ANY($2::uuid[])
        GROUP BY l.id
      `,
      [tenantId, productIds]
    );
    return (result.rows ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      branchId: row.branch_id,
      lotCode: row.lot_code,
      expirationDate: row.expiration_date,
      status: row.status,
      onHand: Number(row.on_hand),
      reserved: Number(row.reserved),
      balanceCount: Number(row.balance_count),
      locationId: row.location_id,
    }));
  }

  async listTemplateProducts(
    tenantId: string,
    branchId: string
  ): Promise<StockImportTemplateProduct[]> {
    const result = await this.db.query<{
      id: string;
      sku: string;
      name: string;
      requires_lot: boolean | null;
      stock: string | number | null;
    }>(
      `
        SELECT p.id, p.sku, p.name, p.requires_lot, COALESCE(s.stock, 0) AS stock
        FROM products p
        LEFT JOIN (
          SELECT
            product_id,
            COALESCE(SUM(quantity) FILTER (WHERE type = 'IN'), 0)
              - COALESCE(SUM(quantity) FILTER (WHERE type = 'OUT'), 0) AS stock
          FROM stock_movements
          WHERE tenant_id = $1 AND branch_id = $2
          GROUP BY product_id
        ) s ON s.product_id = p.id
        WHERE p.tenant_id = $1
          AND p.is_active = TRUE
        ORDER BY p.name ASC
      `,
      [tenantId, branchId]
    );
    return (result.rows ?? []).map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      requiresLot: Boolean(row.requires_lot),
      stock: Number(row.stock ?? 0),
    }));
  }

  async listTemplateLots(
    tenantId: string,
    branchId: string
  ): Promise<StockImportTemplateLot[]> {
    const result = await this.db.query<{
      product_id: string;
      lot_code: string;
      expiration_date: string | null;
      on_hand: string | number;
    }>(
      `
        SELECT
          l.product_id,
          l.lot_code,
          TO_CHAR(l.expiration_date, 'YYYY-MM-DD') AS expiration_date,
          COALESCE(SUM(b.quantity_on_hand), 0) AS on_hand
        FROM inventory_lots l
        LEFT JOIN inventory_lot_balances b
          ON b.lot_id = l.id
         AND b.tenant_id = l.tenant_id
        WHERE l.tenant_id = $1
          AND l.branch_id = $2
          AND l.status IN ('ACTIVE', 'EXPIRED')
        GROUP BY l.id
        HAVING COALESCE(SUM(b.quantity_on_hand), 0) > 0
        ORDER BY l.expiration_date NULLS LAST, l.lot_code
      `,
      [tenantId, branchId]
    );
    return (result.rows ?? []).map((row) => ({
      productId: row.product_id,
      lotCode: row.lot_code,
      expirationDate: row.expiration_date,
      onHand: Number(row.on_hand),
    }));
  }

  async lockTenant(client: Queryable, tenantId: string) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `stock-import:${tenantId}`,
    ]);
  }

  async insertMovements(
    client: Queryable,
    input: {
      tenantId: string;
      referenceId: string;
      userId: string | null;
      createdAt: Date;
      movements: StockImportMovementInsert[];
    }
  ) {
    for (const part of chunk(input.movements)) {
      await client.query(
        `
          INSERT INTO stock_movements (
            id, tenant_id, product_id, type, quantity, reference_type, reference_id,
            branch_id, terminal_id, pos_session_code, user_id, reference_table,
            stock_before, stock_after, created_at
          )
          SELECT
            u.id, $1, u.product_id, u.type, u.quantity, 'ADJUSTMENT', $2,
            u.branch_id, NULL, NULL, $3, $4,
            u.stock_before, u.stock_after, $5
          FROM UNNEST(
            $6::uuid[], $7::uuid[], $8::uuid[], $9::text[], $10::numeric[], $11::numeric[], $12::numeric[]
          ) AS u(id, product_id, branch_id, type, quantity, stock_before, stock_after)
        `,
        [
          input.tenantId,
          input.referenceId,
          input.userId,
          STOCK_IMPORT_REFERENCE_TABLE,
          input.createdAt,
          part.map((item) => item.id),
          part.map((item) => item.productId),
          part.map((item) => item.branchId),
          part.map((item) => item.type),
          part.map((item) => item.quantity),
          part.map((item) => item.stockBefore),
          part.map((item) => item.stockAfter),
        ]
      );
    }
  }

  async insertLots(
    client: Queryable,
    input: { tenantId: string; receivedAt: Date; lots: StockImportLotInsert[] }
  ) {
    const resolved = new Map<string, string>();
    for (const part of chunk(input.lots)) {
      await client.query(
        `
          INSERT INTO inventory_lots (
            id, tenant_id, branch_id, product_id, lot_code, expiration_date,
            received_at, unit_cost, status, is_legacy, created_at, updated_at
          )
          SELECT
            u.id, $1, u.branch_id, u.product_id, u.lot_code, u.expiration_date,
            $2, u.unit_cost, 'ACTIVE', FALSE, $2, $2
          FROM UNNEST(
            $3::uuid[], $4::uuid[], $5::uuid[], $6::text[], $7::date[], $8::numeric[]
          ) AS u(id, branch_id, product_id, lot_code, expiration_date, unit_cost)
          ON CONFLICT (tenant_id, branch_id, product_id, lot_code) DO NOTHING
        `,
        [
          input.tenantId,
          input.receivedAt,
          part.map((item) => item.id),
          part.map((item) => item.branchId),
          part.map((item) => item.productId),
          part.map((item) => item.lotCode),
          part.map((item) => item.expirationDate),
          part.map((item) => item.unitCost),
        ]
      );

      const reread = await client.query<{
        id: string;
        product_id: string;
        branch_id: string;
        lot_code: string;
      }>(
        `
          SELECT l.id, l.product_id, l.branch_id, l.lot_code
          FROM inventory_lots l
          JOIN UNNEST($2::uuid[], $3::uuid[], $4::text[]) AS u(branch_id, product_id, lot_code)
            ON l.branch_id = u.branch_id
           AND l.product_id = u.product_id
           AND l.lot_code = u.lot_code
          WHERE l.tenant_id = $1
        `,
        [
          input.tenantId,
          part.map((item) => item.branchId),
          part.map((item) => item.productId),
          part.map((item) => item.lotCode),
        ]
      );
      for (const row of reread.rows ?? []) {
        resolved.set(`${row.product_id}|${row.branch_id}|${row.lot_code}`, row.id);
      }
    }
    return resolved;
  }

  async upsertLotBalances(
    client: Queryable,
    input: { tenantId: string; movedAt: Date; balances: StockImportBalanceUpsert[] }
  ) {
    const withoutLocation = input.balances.filter((item) => !item.locationId);
    const withLocation = input.balances.filter((item) => item.locationId);

    for (const part of chunk(withoutLocation)) {
      await client.query(
        `
          INSERT INTO inventory_lot_balances (
            tenant_id, branch_id, product_id, lot_id, location_id,
            quantity_on_hand, quantity_reserved, last_movement_at, created_at, updated_at
          )
          SELECT $1, u.branch_id, u.product_id, u.lot_id, NULL, u.quantity, 0, $2, $2, $2
          FROM UNNEST($3::uuid[], $4::uuid[], $5::uuid[], $6::numeric[])
            AS u(branch_id, product_id, lot_id, quantity)
          ON CONFLICT (tenant_id, branch_id, product_id, lot_id) WHERE location_id IS NULL
          DO UPDATE SET
            quantity_on_hand = EXCLUDED.quantity_on_hand,
            last_movement_at = EXCLUDED.last_movement_at,
            updated_at = EXCLUDED.updated_at
        `,
        [
          input.tenantId,
          input.movedAt,
          part.map((item) => item.branchId),
          part.map((item) => item.productId),
          part.map((item) => item.lotId),
          part.map((item) => item.quantityOnHand),
        ]
      );
    }

    for (const part of chunk(withLocation)) {
      await client.query(
        `
          INSERT INTO inventory_lot_balances (
            tenant_id, branch_id, product_id, lot_id, location_id,
            quantity_on_hand, quantity_reserved, last_movement_at, created_at, updated_at
          )
          SELECT $1, u.branch_id, u.product_id, u.lot_id, u.location_id, u.quantity, 0, $2, $2, $2
          FROM UNNEST($3::uuid[], $4::uuid[], $5::uuid[], $6::uuid[], $7::numeric[])
            AS u(branch_id, product_id, lot_id, location_id, quantity)
          ON CONFLICT (tenant_id, branch_id, product_id, lot_id, location_id)
            WHERE location_id IS NOT NULL
          DO UPDATE SET
            quantity_on_hand = EXCLUDED.quantity_on_hand,
            last_movement_at = EXCLUDED.last_movement_at,
            updated_at = EXCLUDED.updated_at
        `,
        [
          input.tenantId,
          input.movedAt,
          part.map((item) => item.branchId),
          part.map((item) => item.productId),
          part.map((item) => item.lotId),
          part.map((item) => item.locationId),
          part.map((item) => item.quantityOnHand),
        ]
      );
    }
  }

  async insertMovementLots(
    client: Queryable,
    input: { tenantId: string; createdAt: Date; links: StockImportMovementLotInsert[] }
  ) {
    for (const part of chunk(input.links)) {
      await client.query(
        `
          INSERT INTO stock_movement_lots (
            tenant_id, stock_movement_id, product_id, lot_id, location_id, quantity, created_at
          )
          SELECT $1, u.stock_movement_id, u.product_id, u.lot_id, u.location_id, u.quantity, $2
          FROM UNNEST($3::uuid[], $4::uuid[], $5::uuid[], $6::uuid[], $7::numeric[])
            AS u(stock_movement_id, product_id, lot_id, location_id, quantity)
        `,
        [
          input.tenantId,
          input.createdAt,
          part.map((item) => item.stockMovementId),
          part.map((item) => item.productId),
          part.map((item) => item.lotId),
          part.map((item) => item.locationId),
          part.map((item) => item.quantity),
        ]
      );
    }
  }
}
