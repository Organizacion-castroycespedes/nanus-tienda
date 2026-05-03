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

export type InventoryDashboardScope = {
  tenantId: string;
  branchId?: string;
  terminalId?: string;
  cashSessionId?: string;
  startDate: string;
  endDate: string;
};

export type InventoryDashboardSnapshot = {
  summary?: {
    stockTotal?: number;
    productsLow?: number;
    productsOut?: number;
    pendingPurchases?: number;
    pendingOrders?: number;
    salesDay?: number;
    recentMovements?: number;
  };
  header?: {
    tenant?: { id: string; name: string | null } | null;
    branch?: { id: string; name: string | null } | null;
    terminal?: { id: string; name: string | null; code?: string | null } | null;
    cashSession?: {
      id: string;
      status: string;
      openedAt: string;
      cashRegisterId: string;
      cashRegisterName: string | null;
      branchId: string | null;
    } | null;
  };
  charts?: {
    movementSeries?: Array<{ date: string; entries: number; exits: number }>;
    salesSeries?: Array<{ date: string; total: number }>;
    purchaseSeries?: Array<{ date: string; total: number }>;
    topProducts?: Array<{
      id: string;
      name: string;
      sku: string;
      quantity: number;
      total: number;
    }>;
  };
  tables?: {
    recentMovements?: Array<Record<string, unknown>>;
    recentPurchases?: Array<Record<string, unknown>>;
    criticalProducts?: Array<Record<string, unknown>>;
    pendingOrders?: Array<Record<string, unknown>>;
  };
};

export type InventoryFilterOption = {
  id: string;
  name: string;
  extra?: string | null;
};

export type InventoryCashSessionOption = {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  cashRegisterId: string;
  cashRegisterName: string;
  terminalId: string | null;
  terminalName: string | null;
  openedAt: string;
  status: string;
  openedByUserId: string;
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

  async getDashboardSnapshot(scope: InventoryDashboardScope) {
    const result = await this.db.query<{ payload: InventoryDashboardSnapshot }>(
      `
      SELECT inventory_dashboard_snapshot(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5::date,
        $6::date
      ) AS payload
      `,
      [
        scope.tenantId,
        scope.branchId ?? null,
        scope.terminalId ?? null,
        scope.cashSessionId ?? null,
        scope.startDate,
        scope.endDate,
      ]
    );

    return result.rows[0]?.payload ?? {};
  }

  async listTenantOptions() {
    const result = await this.db.query<InventoryFilterOption>(
      `
      SELECT
        t.id,
        COALESCE(t.nombre, t.slug, t.id::text) AS name
      FROM tenants AS t
      WHERE t.activo = TRUE
      ORDER BY COALESCE(t.nombre, t.slug, t.id::text) ASC
      `
    );

    return result.rows ?? [];
  }

  async listBranchOptions(filters: { tenantId: string; branchIds?: string[] }) {
    const params: unknown[] = [filters.tenantId];
    const where: string[] = ["b.tenant_id = $1", "b.estado = 'ACTIVE'"];

    if ((filters.branchIds?.length ?? 0) > 0) {
      params.push(filters.branchIds);
      where.push(`b.id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.db.query<InventoryFilterOption>(
      `
      SELECT
        b.id,
        b.nombre AS name,
        b.codigo AS extra
      FROM tenant_branches AS b
      WHERE ${where.join(" AND ")}
      ORDER BY b.nombre ASC
      `,
      params
    );

    return result.rows ?? [];
  }

  async listTerminalOptions(filters: {
    tenantId: string;
    branchIds?: string[];
    branchId?: string;
  }) {
    const params: unknown[] = [filters.tenantId];
    const where: string[] = ["t.tenant_id = $1", "t.is_active = TRUE"];

    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`t.branch_id = $${params.length}`);
    } else if ((filters.branchIds?.length ?? 0) > 0) {
      params.push(filters.branchIds);
      where.push(`t.branch_id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.db.query<InventoryFilterOption>(
      `
      SELECT
        t.id,
        t.name,
        branch.nombre AS extra
      FROM terminals AS t
      LEFT JOIN tenant_branches AS branch
        ON branch.id = t.branch_id
       AND branch.tenant_id = t.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY t.name ASC
      `,
      params
    );

    return result.rows ?? [];
  }

  async listActiveCashSessionOptions(filters: {
    tenantId: string;
    branchIds?: string[];
    branchId?: string;
    terminalId?: string;
    openedByUserId?: string;
  }) {
    const params: unknown[] = [filters.tenantId];
    const where: string[] = ["session.tenant_id = $1", "session.status = 'OPEN'"];

    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`session.branch_id = $${params.length}`);
    } else if ((filters.branchIds?.length ?? 0) > 0) {
      params.push(filters.branchIds);
      where.push(`session.branch_id = ANY($${params.length}::uuid[])`);
    }

    if (filters.terminalId) {
      params.push(filters.terminalId);
      where.push(`register.terminal_id = $${params.length}`);
    }

    if (filters.openedByUserId) {
      params.push(filters.openedByUserId);
      where.push(`session.opened_by_user_id = $${params.length}`);
    }

    const result = await this.db.query<InventoryCashSessionOption>(
      `
      SELECT
        session.id,
        COALESCE(register.nombre, register.codigo, session.id::text) AS name,
        session.branch_id::text AS "branchId",
        branch.nombre AS "branchName",
        session.cash_register_id::text AS "cashRegisterId",
        register.nombre AS "cashRegisterName",
        register.terminal_id::text AS "terminalId",
        terminal.name AS "terminalName",
        session.opened_at::text AS "openedAt",
        session.status,
        session.opened_by_user_id::text AS "openedByUserId"
      FROM cash_sessions AS session
      INNER JOIN cash_registers AS register
        ON register.id = session.cash_register_id
       AND register.tenant_id = session.tenant_id
      INNER JOIN tenant_branches AS branch
        ON branch.id = session.branch_id
       AND branch.tenant_id = session.tenant_id
      LEFT JOIN terminals AS terminal
        ON terminal.id = register.terminal_id
       AND terminal.tenant_id = register.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY session.opened_at DESC, session.id DESC
      `,
      params
    );

    return result.rows ?? [];
  }
}
