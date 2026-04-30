import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";

export type InventoryProductRow = QueryResultRow & {
  tenant_id: string;
  tenant_name: string;
  branch_id: string;
  branch_name: string;
  product_id: string;
  product_name: string;
  unit_id: string;
  tax_id: string | null;
  description: string | null;
  sku: string;
  price: string | number;
  cost: string | number;
  price_with_tax: string | number;
  price_without_tax: string | number;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  stock: string | number;
  terminal_name: string | null;
};

@Injectable()
export class InventoryRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  async listInventoryProducts(filters: {
    tenantId?: string;
    branchId?: string;
  }) {
    const params: unknown[] = [];
    const where: string[] = ["p.is_active = TRUE", "b.estado = 'ACTIVE'"];

    if (filters.tenantId) {
      params.push(filters.tenantId);
      where.push(`p.tenant_id = $${params.length}`);
    }

    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`b.id = $${params.length}`);
    }

    const result = await this.db.query<InventoryProductRow>(
      `
      SELECT
        p.tenant_id,
        t.nombre AS tenant_name,
        b.id AS branch_id,
        b.nombre AS branch_name,
        p.id AS product_id,
        p.name AS product_name,
        p.unit_id,
        p.tax_id,
        p.description,
        p.sku,
        p.price,
        p.cost,
        p.price_with_tax,
        p.price_without_tax,
        p.is_active,
        p.created_at,
        p.updated_at,
        COALESCE(stock_summary.stock, 0) AS stock,
        last_movement.terminal_name
      FROM products p
      INNER JOIN tenants t
        ON t.id = p.tenant_id
      INNER JOIN tenant_branches b
        ON b.tenant_id = p.tenant_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN sm.type = 'IN' THEN sm.quantity
                ELSE -sm.quantity
              END
            ),
            0
          ) AS stock
        FROM stock_movements sm
        WHERE sm.tenant_id = p.tenant_id
          AND sm.product_id = p.id
          AND sm.branch_id = b.id
      ) AS stock_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT term.name AS terminal_name
        FROM stock_movements sm_last
        LEFT JOIN terminals term
          ON term.id = sm_last.terminal_id
        WHERE sm_last.tenant_id = p.tenant_id
          AND sm_last.product_id = p.id
          AND sm_last.branch_id = b.id
        ORDER BY sm_last.created_at DESC, sm_last.id DESC
        LIMIT 1
      ) AS last_movement ON TRUE
      WHERE ${where.join("\n        AND ")}
      ORDER BY
        t.nombre ASC,
        b.nombre ASC,
        p.name ASC,
        p.sku ASC
      `,
      params
    );

    return result.rows ?? [];
  }
}
