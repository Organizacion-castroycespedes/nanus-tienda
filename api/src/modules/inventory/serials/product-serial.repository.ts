import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";

export const PRODUCT_SERIAL_STATUSES = ["AVAILABLE", "SOLD", "RETURNED", "BLOCKED", "WRITTEN_OFF"] as const;
export type ProductSerialStatus = (typeof PRODUCT_SERIAL_STATUSES)[number];

export type SerialProductRow = QueryResultRow & {
  id: string;
  name: string;
  sku: string;
  requires_serial: boolean;
};

export type ProductSerialRow = QueryResultRow & {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  branch_id: string;
  branch_name: string | null;
  location_id: string | null;
  location_code: string | null;
  location_name: string | null;
  serial_number: string;
  serial_number_normalized: string;
  status: ProductSerialStatus;
  source_type: "PURCHASE" | "ADJUSTMENT";
  purchase_id: string | null;
  sale_id: string | null;
  order_id: string | null;
  customer_id: string | null;
  received_at: Date | string;
  sold_at: Date | string | null;
  total_count?: string | number;
};

export type ProductSerialEventRow = QueryResultRow & {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string;
  branch_id: string;
  from_location_code: string | null;
  to_location_code: string | null;
  reference_type: string | null;
  reference_id: string | null;
  stock_movement_id: string | null;
  user_id: string | null;
  reason: string | null;
  created_at: Date | string;
};

export type ProductSerialSearchFilters = {
  tenantId: string;
  branchIds: string[] | null;
  productId?: string;
  status?: ProductSerialStatus;
  search?: string;
  limit: number;
  offset: number;
};

const SERIAL_SELECT = `
  s.id,
  s.product_id,
  p.name AS product_name,
  p.sku AS product_sku,
  s.branch_id,
  b.nombre AS branch_name,
  s.location_id,
  l.code AS location_code,
  l.name AS location_name,
  s.serial_number,
  s.serial_number_normalized,
  s.status,
  s.source_type,
  s.purchase_id,
  s.sale_id,
  s.order_id,
  s.customer_id,
  s.received_at,
  s.sold_at
`;

const SERIAL_FROM = `
  FROM product_serials s
  JOIN products p ON p.id = s.product_id AND p.tenant_id = s.tenant_id
  LEFT JOIN tenant_branches b ON b.id = s.branch_id
  LEFT JOIN inventory_locations l ON l.id = s.location_id
`;

@Injectable()
export class ProductSerialRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  /** Cliente para operaciones propias de series (inspección, mover ubicación). */
  getClient() {
    return this.db.getClient();
  }

  private async query<T extends QueryResultRow>(text: string, params: unknown[] = [], client?: PoolClient) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query<T>(text, params);
  }

  async findProduct(tenantId: string, productId: string) {
    const result = await this.query<SerialProductRow>(
      `SELECT id, name, sku, requires_serial
         FROM products
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1`,
      [productId, tenantId]
    );
    return result.rows[0] ?? null;
  }

  async branchBelongsToTenant(tenantId: string, branchId: string) {
    const result = await this.query(
      `SELECT 1 FROM tenant_branches WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [branchId, tenantId]
    );
    return result.rows.length > 0;
  }

  async findRegistered(tenantId: string, productId: string, normalized: string[]) {
    if (normalized.length === 0) {
      return [] as Array<{ serial_number_normalized: string; status: ProductSerialStatus }>;
    }
    const result = await this.query<{ serial_number_normalized: string; status: ProductSerialStatus }>(
      `SELECT serial_number_normalized, status
         FROM product_serials
        WHERE tenant_id = $1
          AND product_id = $2
          AND serial_number_normalized = ANY($3::text[])`,
      [tenantId, productId, normalized]
    );
    return result.rows;
  }

  async findInOtherProducts(tenantId: string, productId: string, normalized: string[]) {
    if (normalized.length === 0) {
      return [] as Array<{ serial_number_normalized: string; product_name: string; product_sku: string }>;
    }
    const result = await this.query<{ serial_number_normalized: string; product_name: string; product_sku: string }>(
      `SELECT s.serial_number_normalized, p.name AS product_name, p.sku AS product_sku
         FROM product_serials s
         JOIN products p ON p.id = s.product_id
        WHERE s.tenant_id = $1
          AND s.product_id <> $2
          AND s.serial_number_normalized = ANY($3::text[])
        ORDER BY s.serial_number_normalized`,
      [tenantId, productId, normalized]
    );
    return result.rows;
  }

  async listByProduct(input: {
    tenantId: string;
    productId: string;
    branchId: string;
    status: ProductSerialStatus;
    search?: string;
    limit: number;
    offset: number;
  }) {
    const result = await this.query<ProductSerialRow>(
      `SELECT ${SERIAL_SELECT}, count(*) OVER () AS total_count
         ${SERIAL_FROM}
        WHERE s.tenant_id = $1
          AND s.product_id = $2
          AND s.branch_id = $3
          AND s.status = $4
          AND ($5::text IS NULL OR strpos(s.serial_number_normalized, $5::text) > 0)
        ORDER BY s.serial_number_normalized
        LIMIT $6 OFFSET $7`,
      [input.tenantId, input.productId, input.branchId, input.status, input.search ?? null, input.limit, input.offset]
    );
    return result.rows;
  }

  async findBySerialNumber(input: {
    tenantId: string;
    normalized: string;
    branchIds: string[] | null;
    productId?: string;
  }) {
    const result = await this.query<ProductSerialRow>(
      `SELECT ${SERIAL_SELECT}
         ${SERIAL_FROM}
        WHERE s.tenant_id = $1
          AND s.serial_number_normalized = $2
          AND ($3::uuid[] IS NULL OR s.branch_id = ANY($3::uuid[]))
          AND ($4::uuid IS NULL OR s.product_id = $4::uuid)
        ORDER BY p.name
        LIMIT 20`,
      [input.tenantId, input.normalized, input.branchIds, input.productId ?? null]
    );
    return result.rows;
  }

  async search(filters: ProductSerialSearchFilters) {
    const result = await this.query<ProductSerialRow>(
      `SELECT ${SERIAL_SELECT}, count(*) OVER () AS total_count
         ${SERIAL_FROM}
        WHERE s.tenant_id = $1
          AND ($2::uuid[] IS NULL OR s.branch_id = ANY($2::uuid[]))
          AND ($3::uuid IS NULL OR s.product_id = $3::uuid)
          AND ($4::text IS NULL OR s.status = $4::text)
          AND (
            $5::text IS NULL
            OR strpos(s.serial_number_normalized, upper($5::text)) > 0
            OR strpos(upper(p.name), upper($5::text)) > 0
            OR strpos(upper(p.sku), upper($5::text)) > 0
          )
        ORDER BY s.updated_at DESC, s.serial_number_normalized
        LIMIT $6 OFFSET $7`,
      [
        filters.tenantId,
        filters.branchIds,
        filters.productId ?? null,
        filters.status ?? null,
        filters.search ?? null,
        filters.limit,
        filters.offset,
      ]
    );
    return result.rows;
  }

  async findById(tenantId: string, serialId: string) {
    const result = await this.query<ProductSerialRow>(
      `SELECT ${SERIAL_SELECT}
         ${SERIAL_FROM}
        WHERE s.tenant_id = $1 AND s.id = $2
        LIMIT 1`,
      [tenantId, serialId]
    );
    return result.rows[0] ?? null;
  }

  /** fnc_product_serials_register (V117) dentro de la transacción del llamador. */
  async registerSerials(
    client: PoolClient,
    input: {
      tenantId: string;
      branchId: string;
      productId: string;
      sourceType: "PURCHASE" | "ADJUSTMENT";
      sourceId: string | null;
      sourceItemId: string | null;
      stockMovementId: string | null;
      serials: Array<{ serial: string; locationId: string | null }>;
      defaultLocationId: string | null;
      userId: string | null;
    }
  ) {
    const result = await client.query<{ serial_id: string; serial_number: string }>(
      `SELECT serial_id, serial_number
         FROM public.fnc_product_serials_register(
           $1::uuid, $2::uuid, $3::uuid, $4::text, $5::uuid, $6::uuid, $7::uuid, $8::jsonb, $9::uuid, $10::uuid
         )`,
      [
        input.tenantId,
        input.branchId,
        input.productId,
        input.sourceType,
        input.sourceId,
        input.sourceItemId,
        input.stockMovementId,
        JSON.stringify(input.serials),
        input.defaultLocationId,
        input.userId,
      ]
    );
    return result.rows;
  }

  /** Asigna series a las líneas de una venta ya creada (misma transacción). */
  async assignSale(
    client: PoolClient,
    input: {
      tenantId: string;
      branchId: string;
      saleId: string;
      lines: Array<{ saleItemId: string; serialIds: string[] }>;
      userId: string | null;
    }
  ) {
    const result = await client.query<{ assigned: number }>(
      `SELECT public.fnc_product_serials_assign_sale($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::uuid) AS assigned`,
      [input.tenantId, input.branchId, input.saleId, JSON.stringify(input.lines), input.userId]
    );
    return Number(result.rows[0]?.assigned ?? 0);
  }

  /** Asigna series a una entrega de pedido (misma transacción que los OUT). */
  async assignOrderDelivery(
    client: PoolClient,
    input: {
      tenantId: string;
      branchId: string;
      orderId: string;
      lines: Array<{ productId: string; quantity: number; stockMovementId: string; serialIds: string[] }>;
      userId: string | null;
    }
  ) {
    const result = await client.query<{ assigned: number }>(
      `SELECT public.fnc_product_serials_assign_order_delivery($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::uuid) AS assigned`,
      [input.tenantId, input.branchId, input.orderId, JSON.stringify(input.lines), input.userId]
    );
    return Number(result.rows[0]?.assigned ?? 0);
  }

  /** Ramas de un conjunto de series (para validar el alcance antes de escribir). */
  async findBranchesForSerials(tenantId: string, serialIds: string[]) {
    const result = await this.query<{ id: string; branch_id: string }>(
      `SELECT s.id, s.branch_id
         FROM public.product_serials s
        WHERE s.tenant_id = $1 AND s.id = ANY($2::uuid[])`,
      [tenantId, serialIds]
    );
    return result.rows;
  }

  async lockStockScope(client: PoolClient, tenantId: string, branchId: string, productId: string) {
    await client.query(`SELECT public.inventory_lock_stock_scope($1::uuid, $2::uuid, $3::uuid)`, [
      tenantId,
      branchId,
      productId,
    ]);
  }

  /** Inspección o bloqueo (fnc_product_serials_inspect). */
  async inspect(
    client: PoolClient,
    input: {
      tenantId: string;
      serialId: string;
      result: string;
      reason: string;
      userId: string | null;
      stockMovementId: string | null;
    }
  ) {
    const result = await client.query<{ status: string }>(
      `SELECT public.fnc_product_serials_inspect($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid, $6::uuid) AS status`,
      [input.tenantId, input.serialId, input.result, input.reason, input.userId, input.stockMovementId]
    );
    return result.rows[0]?.status ?? input.result;
  }

  /** Baja por ajuste de salida (fnc_product_serials_write_off). */
  async writeOff(
    client: PoolClient,
    input: {
      tenantId: string;
      branchId: string;
      productId: string;
      serialIds: string[];
      stockMovementId: string;
      userId: string | null;
      reason: string | null;
    }
  ) {
    const result = await client.query<{ written_off: number }>(
      `SELECT public.fnc_product_serials_write_off($1::uuid, $2::uuid, $3::uuid, $4::uuid[], $5::uuid, $6::uuid, $7::text) AS written_off`,
      [
        input.tenantId,
        input.branchId,
        input.productId,
        input.serialIds,
        input.stockMovementId,
        input.userId,
        input.reason,
      ]
    );
    return Number(result.rows[0]?.written_off ?? 0);
  }

  /** Cambio de ubicación sin movimiento de kardex (fnc_product_serials_move_location). */
  async moveLocation(
    client: PoolClient,
    input: { tenantId: string; serialIds: string[]; locationId: string | null; userId: string | null; reason: string | null }
  ) {
    const result = await client.query<{ moved: number }>(
      `SELECT public.fnc_product_serials_move_location($1::uuid, $2::uuid[], $3::uuid, $4::uuid, $5::text) AS moved`,
      [input.tenantId, input.serialIds, input.locationId, input.userId, input.reason]
    );
    return Number(result.rows[0]?.moved ?? 0);
  }

  /** Anulación: RETURNED si el inventario vuelve, o evento VOIDED_NOT_RETURNED si no. */
  async markSaleReturned(
    client: PoolClient,
    input: { tenantId: string; saleId: string; returnInventory: boolean; userId: string | null; reason: string | null }
  ) {
    const result = await client.query<{ affected: number }>(
      `SELECT public.prc_product_serials_mark_returned($1::uuid, $2::uuid, $3::boolean, $4::uuid, $5::text) AS affected`,
      [input.tenantId, input.saleId, input.returnInventory, input.userId, input.reason]
    );
    return Number(result.rows[0]?.affected ?? 0);
  }

  async findEvents(tenantId: string, serialId: string) {
    const result = await this.query<ProductSerialEventRow>(
      `SELECT
          e.id,
          e.event_type,
          e.from_status,
          e.to_status,
          e.branch_id,
          fl.code AS from_location_code,
          tl.code AS to_location_code,
          e.reference_type,
          e.reference_id,
          e.stock_movement_id,
          e.user_id,
          e.reason,
          e.created_at
         FROM product_serial_events e
         LEFT JOIN inventory_locations fl ON fl.id = e.from_location_id
         LEFT JOIN inventory_locations tl ON tl.id = e.to_location_id
        WHERE e.tenant_id = $1 AND e.serial_id = $2
        ORDER BY e.created_at, e.id`,
      [tenantId, serialId]
    );
    return result.rows;
  }
}
