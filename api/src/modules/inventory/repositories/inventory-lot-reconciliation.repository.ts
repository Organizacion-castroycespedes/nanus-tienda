import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";

export const INVENTORY_LOT_DISCREPANCY_TYPES = [
  "LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK",
  "LOT_LINK_WITHOUT_MOVEMENT",
  "LOT_LINK_PRODUCT_MISMATCH",
  "LOT_LINK_TENANT_MISMATCH",
  "LOT_BALANCE_WITHOUT_LOT",
  "LOT_BALANCE_PRODUCT_BRANCH_MISMATCH",
  "LOT_BALANCE_NEGATIVE_OR_RESERVED_INVALID",
  "LOT_BALANCE_DIFFERS_FROM_MOVEMENT_LINKS",
  "EXPIRED_ACTIVE_LOT",
  "BLOCKED_OR_CANCELLED_LOT_WITH_AVAILABLE_BALANCE",
  "LOT_REQUIRED_PRODUCT_WITH_NON_LOTTED_STOCK",
] as const;

export type InventoryLotDiscrepancyType =
  (typeof INVENTORY_LOT_DISCREPANCY_TYPES)[number];

export type InventoryLotReconciliationFilters = {
  branchId?: string;
  productId?: string;
  lotId?: string;
  from?: Date;
  to?: Date;
  onlyDiscrepancies?: boolean;
  discrepancyType?: InventoryLotDiscrepancyType;
};

export type InventoryLotReconciliationCounts = {
  totalProductsChecked: number;
  totalLotsChecked: number;
  totalBalancesChecked: number;
  totalMovementsChecked: number;
  totalLinksChecked: number;
};

export type InventoryLotDiscrepancyRecord = {
  discrepancyType: InventoryLotDiscrepancyType;
  tenantId: string;
  branchId: string | null;
  productId: string | null;
  lotId: string | null;
  stockMovementId: string | null;
  stockMovementLotId: string | null;
  balanceId: string | null;
  expectedQuantity: number | null;
  actualQuantity: number | null;
  quantityDelta: number | null;
  message: string;
  detectedAt: Date;
};

type DiscrepancyRow = QueryResultRow & {
  discrepancy_type: InventoryLotDiscrepancyType;
  tenant_id: string;
  branch_id: string | null;
  product_id: string | null;
  lot_id: string | null;
  stock_movement_id: string | null;
  stock_movement_lot_id: string | null;
  balance_id: string | null;
  expected_quantity: string | number | null;
  actual_quantity: string | number | null;
  quantity_delta: string | number | null;
  message: string;
  detected_at: string | Date;
};

type CountRow = QueryResultRow & {
  count: string | number;
};

type ProductReconciliationRow = QueryResultRow & {
  product_id: string;
  requires_lot: boolean;
  aggregate_stock_quantity: string | number | null;
  linked_quantity: string | number | null;
  balance_quantity: string | number | null;
  lot_count: string | number;
  balance_count: string | number;
  movement_count: string | number;
  link_count: string | number;
};

type LotReconciliationRow = QueryResultRow & {
  lot_id: string;
  branch_id: string;
  product_id: string;
  status: string;
  expiration_date: string | Date | null;
  linked_quantity: string | number | null;
  balance_quantity: string | number | null;
  balance_available_quantity: string | number | null;
  balance_count: string | number;
  link_count: string | number;
};

type FilterColumnMap = {
  branchId?: string;
  productId?: string;
  lotId?: string;
  date?: string;
};

@Injectable()
export class InventoryLotReconciliationRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private toNumber(value: string | number | null | undefined) {
    if (value == null) {
      return 0;
    }
    return typeof value === "number" ? value : Number(value);
  }

  private toNullableNumber(value: string | number | null | undefined) {
    if (value == null) {
      return null;
    }
    return typeof value === "number" ? value : Number(value);
  }

  private addFilters(
    clauses: string[],
    params: unknown[],
    filters: InventoryLotReconciliationFilters,
    columns: FilterColumnMap
  ) {
    if (filters.branchId) {
      if (columns.branchId) {
        params.push(filters.branchId);
        clauses.push(`${columns.branchId} = $${params.length}`);
      } else {
        clauses.push("FALSE");
      }
    }

    if (filters.productId) {
      if (columns.productId) {
        params.push(filters.productId);
        clauses.push(`${columns.productId} = $${params.length}`);
      } else {
        clauses.push("FALSE");
      }
    }

    if (filters.lotId) {
      if (columns.lotId) {
        params.push(filters.lotId);
        clauses.push(`${columns.lotId} = $${params.length}`);
      } else {
        clauses.push("FALSE");
      }
    }

    if (filters.from) {
      if (columns.date) {
        params.push(filters.from);
        clauses.push(`${columns.date} >= $${params.length}`);
      } else {
        clauses.push("FALSE");
      }
    }

    if (filters.to) {
      if (columns.date) {
        params.push(filters.to);
        clauses.push(`${columns.date} <= $${params.length}`);
      } else {
        clauses.push("FALSE");
      }
    }
  }

  private mapDiscrepancy(row: DiscrepancyRow): InventoryLotDiscrepancyRecord {
    return {
      discrepancyType: row.discrepancy_type,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      productId: row.product_id,
      lotId: row.lot_id,
      stockMovementId: row.stock_movement_id,
      stockMovementLotId: row.stock_movement_lot_id,
      balanceId: row.balance_id,
      expectedQuantity: this.toNullableNumber(row.expected_quantity),
      actualQuantity: this.toNullableNumber(row.actual_quantity),
      quantityDelta: this.toNullableNumber(row.quantity_delta),
      message: row.message,
      detectedAt: new Date(row.detected_at),
    };
  }

  private async count(
    sql: string,
    params: unknown[]
  ): Promise<number> {
    const result = await this.db.query<CountRow>(sql, params);
    return this.toNumber(result.rows[0]?.count);
  }

  async getSummary(
    tenantId: string,
    filters: InventoryLotReconciliationFilters = {}
  ): Promise<InventoryLotReconciliationCounts> {
    const productParams: unknown[] = [tenantId];
    const productClauses = ["tenant_id = $1"];
    if (filters.productId) {
      productParams.push(filters.productId);
      productClauses.push(`id = $${productParams.length}`);
    }

    const lotParams: unknown[] = [tenantId];
    const lotClauses = ["tenant_id = $1"];
    this.addFilters(lotClauses, lotParams, filters, {
      branchId: "branch_id",
      productId: "product_id",
      lotId: "id",
      date: "created_at",
    });

    const balanceParams: unknown[] = [tenantId];
    const balanceClauses = ["tenant_id = $1"];
    this.addFilters(balanceClauses, balanceParams, filters, {
      branchId: "branch_id",
      productId: "product_id",
      lotId: "lot_id",
      date: "created_at",
    });

    const movementParams: unknown[] = [tenantId];
    const movementClauses = ["tenant_id = $1"];
    this.addFilters(movementClauses, movementParams, filters, {
      branchId: "branch_id",
      productId: "product_id",
      date: "created_at",
    });
    if (filters.lotId) {
      movementClauses.push("FALSE");
    }

    const linkParams: unknown[] = [tenantId];
    const linkClauses = ["sml.tenant_id = $1"];
    this.addFilters(linkClauses, linkParams, filters, {
      branchId: "COALESCE(sm.branch_id, lot.branch_id)",
      productId: "sml.product_id",
      lotId: "sml.lot_id",
      date: "sml.created_at",
    });

    const [
      totalProductsChecked,
      totalLotsChecked,
      totalBalancesChecked,
      totalMovementsChecked,
      totalLinksChecked,
    ] = await Promise.all([
      this.count(
        `SELECT COUNT(*) AS count FROM products WHERE ${productClauses.join(" AND ")}`,
        productParams
      ),
      this.count(
        `SELECT COUNT(*) AS count FROM inventory_lots WHERE ${lotClauses.join(" AND ")}`,
        lotParams
      ),
      this.count(
        `SELECT COUNT(*) AS count FROM inventory_lot_balances WHERE ${balanceClauses.join(" AND ")}`,
        balanceParams
      ),
      this.count(
        `SELECT COUNT(*) AS count FROM stock_movements WHERE ${movementClauses.join(" AND ")}`,
        movementParams
      ),
      this.count(
        `
        SELECT COUNT(*) AS count
        FROM stock_movement_lots AS sml
        LEFT JOIN stock_movements AS sm ON sm.id = sml.stock_movement_id
        LEFT JOIN inventory_lots AS lot ON lot.id = sml.lot_id
        WHERE ${linkClauses.join(" AND ")}
        `,
        linkParams
      ),
    ]);

    return {
      totalProductsChecked,
      totalLotsChecked,
      totalBalancesChecked,
      totalMovementsChecked,
      totalLinksChecked,
    };
  }

  async findDiscrepancies(
    tenantId: string,
    filters: InventoryLotReconciliationFilters = {}
  ): Promise<InventoryLotDiscrepancyRecord[]> {
    const params: unknown[] = [tenantId];
    const parts: string[] = [];

    const addPart = (
      type: InventoryLotDiscrepancyType,
      sql: string,
      clauses: string[],
      columns: FilterColumnMap
    ) => {
      if (filters.discrepancyType && filters.discrepancyType !== type) {
        return;
      }
      this.addFilters(clauses, params, filters, columns);
      const partIndex = parts.length;
      parts.push(
        `
        SELECT *
        FROM (
          ${sql.replace("__WHERE__", clauses.join("\n        AND "))}
        ) AS discrepancy_part_${partIndex}
        `
      );
    };

    addPart(
      "LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK",
      `
      SELECT
        'LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK'::text AS discrepancy_type,
        sm.tenant_id,
        sm.branch_id,
        sm.product_id,
        NULL::uuid AS lot_id,
        sm.id AS stock_movement_id,
        NULL::uuid AS stock_movement_lot_id,
        NULL::uuid AS balance_id,
        sm.quantity::numeric AS expected_quantity,
        0::numeric AS actual_quantity,
        sm.quantity::numeric AS quantity_delta,
        'stock movement for lot-required product has no lot link' AS message,
        NOW() AS detected_at
      FROM stock_movements AS sm
      INNER JOIN products AS product
        ON product.id = sm.product_id
       AND product.tenant_id = sm.tenant_id
      LEFT JOIN stock_movement_lots AS sml
        ON sml.stock_movement_id = sm.id
       AND sml.tenant_id = sm.tenant_id
      WHERE __WHERE__
        AND product.requires_lot = true
        AND sml.id IS NULL
      `,
      ["sm.tenant_id = $1"],
      {
        branchId: "sm.branch_id",
        productId: "sm.product_id",
        date: "sm.created_at",
      }
    );

    addPart(
      "LOT_LINK_WITHOUT_MOVEMENT",
      `
      SELECT
        'LOT_LINK_WITHOUT_MOVEMENT'::text AS discrepancy_type,
        sml.tenant_id,
        lot.branch_id,
        sml.product_id,
        sml.lot_id,
        sml.stock_movement_id,
        sml.id AS stock_movement_lot_id,
        NULL::uuid AS balance_id,
        sml.quantity::numeric AS expected_quantity,
        NULL::numeric AS actual_quantity,
        NULL::numeric AS quantity_delta,
        'stock movement lot link points to missing stock movement' AS message,
        NOW() AS detected_at
      FROM stock_movement_lots AS sml
      LEFT JOIN stock_movements AS sm ON sm.id = sml.stock_movement_id
      LEFT JOIN inventory_lots AS lot ON lot.id = sml.lot_id
      WHERE __WHERE__
        AND sm.id IS NULL
      `,
      ["sml.tenant_id = $1"],
      {
        branchId: "lot.branch_id",
        productId: "sml.product_id",
        lotId: "sml.lot_id",
        date: "sml.created_at",
      }
    );

    addPart(
      "LOT_LINK_PRODUCT_MISMATCH",
      `
      SELECT
        'LOT_LINK_PRODUCT_MISMATCH'::text AS discrepancy_type,
        sml.tenant_id,
        COALESCE(sm.branch_id, lot.branch_id),
        sml.product_id,
        sml.lot_id,
        sml.stock_movement_id,
        sml.id AS stock_movement_lot_id,
        NULL::uuid AS balance_id,
        NULL::numeric AS expected_quantity,
        NULL::numeric AS actual_quantity,
        NULL::numeric AS quantity_delta,
        'stock movement lot product does not match movement or lot product' AS message,
        NOW() AS detected_at
      FROM stock_movement_lots AS sml
      LEFT JOIN stock_movements AS sm ON sm.id = sml.stock_movement_id
      LEFT JOIN inventory_lots AS lot ON lot.id = sml.lot_id
      WHERE __WHERE__
        AND (
          (sm.id IS NOT NULL AND sm.product_id <> sml.product_id)
          OR (lot.id IS NOT NULL AND lot.product_id <> sml.product_id)
        )
      `,
      ["sml.tenant_id = $1"],
      {
        branchId: "COALESCE(sm.branch_id, lot.branch_id)",
        productId: "sml.product_id",
        lotId: "sml.lot_id",
        date: "sml.created_at",
      }
    );

    addPart(
      "LOT_LINK_TENANT_MISMATCH",
      `
      SELECT
        'LOT_LINK_TENANT_MISMATCH'::text AS discrepancy_type,
        sml.tenant_id,
        COALESCE(sm.branch_id, lot.branch_id),
        sml.product_id,
        sml.lot_id,
        sml.stock_movement_id,
        sml.id AS stock_movement_lot_id,
        NULL::uuid AS balance_id,
        NULL::numeric AS expected_quantity,
        NULL::numeric AS actual_quantity,
        NULL::numeric AS quantity_delta,
        'stock movement lot tenant does not match movement or lot tenant' AS message,
        NOW() AS detected_at
      FROM stock_movement_lots AS sml
      LEFT JOIN stock_movements AS sm ON sm.id = sml.stock_movement_id
      LEFT JOIN inventory_lots AS lot ON lot.id = sml.lot_id
      WHERE __WHERE__
        AND (
          (sm.id IS NOT NULL AND sm.tenant_id <> sml.tenant_id)
          OR (lot.id IS NOT NULL AND lot.tenant_id <> sml.tenant_id)
        )
      `,
      ["sml.tenant_id = $1"],
      {
        branchId: "COALESCE(sm.branch_id, lot.branch_id)",
        productId: "sml.product_id",
        lotId: "sml.lot_id",
        date: "sml.created_at",
      }
    );

    addPart(
      "LOT_BALANCE_WITHOUT_LOT",
      `
      SELECT
        'LOT_BALANCE_WITHOUT_LOT'::text AS discrepancy_type,
        balance.tenant_id,
        balance.branch_id,
        balance.product_id,
        balance.lot_id,
        NULL::uuid AS stock_movement_id,
        NULL::uuid AS stock_movement_lot_id,
        balance.id AS balance_id,
        NULL::numeric AS expected_quantity,
        balance.quantity_on_hand::numeric AS actual_quantity,
        NULL::numeric AS quantity_delta,
        'lot balance points to missing inventory lot' AS message,
        NOW() AS detected_at
      FROM inventory_lot_balances AS balance
      LEFT JOIN inventory_lots AS lot ON lot.id = balance.lot_id
      WHERE __WHERE__
        AND lot.id IS NULL
      `,
      ["balance.tenant_id = $1"],
      {
        branchId: "balance.branch_id",
        productId: "balance.product_id",
        lotId: "balance.lot_id",
        date: "balance.created_at",
      }
    );

    addPart(
      "LOT_BALANCE_PRODUCT_BRANCH_MISMATCH",
      `
      SELECT
        'LOT_BALANCE_PRODUCT_BRANCH_MISMATCH'::text AS discrepancy_type,
        balance.tenant_id,
        balance.branch_id,
        balance.product_id,
        balance.lot_id,
        NULL::uuid AS stock_movement_id,
        NULL::uuid AS stock_movement_lot_id,
        balance.id AS balance_id,
        NULL::numeric AS expected_quantity,
        balance.quantity_on_hand::numeric AS actual_quantity,
        NULL::numeric AS quantity_delta,
        'lot balance product or branch does not match inventory lot' AS message,
        NOW() AS detected_at
      FROM inventory_lot_balances AS balance
      INNER JOIN inventory_lots AS lot ON lot.id = balance.lot_id
      WHERE __WHERE__
        AND (
          balance.product_id <> lot.product_id
          OR balance.branch_id <> lot.branch_id
        )
      `,
      ["balance.tenant_id = $1"],
      {
        branchId: "balance.branch_id",
        productId: "balance.product_id",
        lotId: "balance.lot_id",
        date: "balance.created_at",
      }
    );

    addPart(
      "LOT_BALANCE_NEGATIVE_OR_RESERVED_INVALID",
      `
      SELECT
        'LOT_BALANCE_NEGATIVE_OR_RESERVED_INVALID'::text AS discrepancy_type,
        balance.tenant_id,
        balance.branch_id,
        balance.product_id,
        balance.lot_id,
        NULL::uuid AS stock_movement_id,
        NULL::uuid AS stock_movement_lot_id,
        balance.id AS balance_id,
        balance.quantity_on_hand::numeric AS expected_quantity,
        balance.quantity_reserved::numeric AS actual_quantity,
        (balance.quantity_on_hand - balance.quantity_reserved)::numeric AS quantity_delta,
        'lot balance has negative quantity or reserved exceeds on hand' AS message,
        NOW() AS detected_at
      FROM inventory_lot_balances AS balance
      WHERE __WHERE__
        AND (
          balance.quantity_on_hand < 0
          OR balance.quantity_reserved < 0
          OR balance.quantity_reserved > balance.quantity_on_hand
        )
      `,
      ["balance.tenant_id = $1"],
      {
        branchId: "balance.branch_id",
        productId: "balance.product_id",
        lotId: "balance.lot_id",
        date: "balance.created_at",
      }
    );

    addPart(
      "LOT_BALANCE_DIFFERS_FROM_MOVEMENT_LINKS",
      `
      WITH linked AS (
        SELECT
          sml.tenant_id,
          sm.branch_id,
          sml.product_id,
          sml.lot_id,
          sml.location_id,
          SUM(CASE WHEN sm.type = 'IN' THEN sml.quantity ELSE -sml.quantity END)::numeric AS expected_quantity
        FROM stock_movement_lots AS sml
        INNER JOIN stock_movements AS sm
          ON sm.id = sml.stock_movement_id
         AND sm.tenant_id = sml.tenant_id
        WHERE sml.tenant_id = $1
        GROUP BY sml.tenant_id, sm.branch_id, sml.product_id, sml.lot_id, sml.location_id
      )
      SELECT
        'LOT_BALANCE_DIFFERS_FROM_MOVEMENT_LINKS'::text AS discrepancy_type,
        balance.tenant_id,
        balance.branch_id,
        balance.product_id,
        balance.lot_id,
        NULL::uuid AS stock_movement_id,
        NULL::uuid AS stock_movement_lot_id,
        balance.id AS balance_id,
        COALESCE(linked.expected_quantity, 0)::numeric AS expected_quantity,
        balance.quantity_on_hand::numeric AS actual_quantity,
        (balance.quantity_on_hand - COALESCE(linked.expected_quantity, 0))::numeric AS quantity_delta,
        'lot balance quantity_on_hand differs from movement lot links' AS message,
        NOW() AS detected_at
      FROM inventory_lot_balances AS balance
      LEFT JOIN linked
        ON linked.tenant_id = balance.tenant_id
       AND linked.branch_id = balance.branch_id
       AND linked.product_id = balance.product_id
       AND linked.lot_id = balance.lot_id
       AND (
         linked.location_id = balance.location_id
         OR (linked.location_id IS NULL AND balance.location_id IS NULL)
       )
      WHERE __WHERE__
        AND balance.quantity_on_hand <> COALESCE(linked.expected_quantity, 0)
      `,
      ["balance.tenant_id = $1"],
      {
        branchId: "balance.branch_id",
        productId: "balance.product_id",
        lotId: "balance.lot_id",
        date: "balance.updated_at",
      }
    );

    addPart(
      "EXPIRED_ACTIVE_LOT",
      `
      SELECT
        'EXPIRED_ACTIVE_LOT'::text AS discrepancy_type,
        lot.tenant_id,
        lot.branch_id,
        lot.product_id,
        lot.id AS lot_id,
        NULL::uuid AS stock_movement_id,
        NULL::uuid AS stock_movement_lot_id,
        NULL::uuid AS balance_id,
        NULL::numeric AS expected_quantity,
        NULL::numeric AS actual_quantity,
        NULL::numeric AS quantity_delta,
        'inventory lot is ACTIVE but expiration_date is in the past' AS message,
        NOW() AS detected_at
      FROM inventory_lots AS lot
      WHERE __WHERE__
        AND lot.status = 'ACTIVE'
        AND lot.expiration_date IS NOT NULL
        AND lot.expiration_date < CURRENT_DATE
      `,
      ["lot.tenant_id = $1"],
      {
        branchId: "lot.branch_id",
        productId: "lot.product_id",
        lotId: "lot.id",
        date: "lot.created_at",
      }
    );

    addPart(
      "BLOCKED_OR_CANCELLED_LOT_WITH_AVAILABLE_BALANCE",
      `
      SELECT
        'BLOCKED_OR_CANCELLED_LOT_WITH_AVAILABLE_BALANCE'::text AS discrepancy_type,
        lot.tenant_id,
        lot.branch_id,
        lot.product_id,
        lot.id AS lot_id,
        NULL::uuid AS stock_movement_id,
        NULL::uuid AS stock_movement_lot_id,
        balance.id AS balance_id,
        0::numeric AS expected_quantity,
        balance.quantity_available::numeric AS actual_quantity,
        balance.quantity_available::numeric AS quantity_delta,
        'blocked or cancelled lot has available balance' AS message,
        NOW() AS detected_at
      FROM inventory_lots AS lot
      INNER JOIN inventory_lot_balances AS balance
        ON balance.lot_id = lot.id
       AND balance.tenant_id = lot.tenant_id
      WHERE __WHERE__
        AND lot.status IN ('BLOCKED', 'CANCELLED')
        AND balance.quantity_available > 0
      `,
      ["lot.tenant_id = $1"],
      {
        branchId: "lot.branch_id",
        productId: "lot.product_id",
        lotId: "lot.id",
        date: "balance.updated_at",
      }
    );

    addPart(
      "LOT_REQUIRED_PRODUCT_WITH_NON_LOTTED_STOCK",
      `
      WITH aggregate_stock AS (
        SELECT
          sm.tenant_id,
          sm.branch_id,
          sm.product_id,
          SUM(CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE -sm.quantity END)::numeric AS stock_quantity
        FROM stock_movements AS sm
        INNER JOIN products AS product
          ON product.id = sm.product_id
         AND product.tenant_id = sm.tenant_id
        WHERE sm.tenant_id = $1
          AND product.requires_lot = true
        GROUP BY sm.tenant_id, sm.branch_id, sm.product_id
      ),
      linked_stock AS (
        SELECT
          sml.tenant_id,
          sm.branch_id,
          sml.product_id,
          SUM(CASE WHEN sm.type = 'IN' THEN sml.quantity ELSE -sml.quantity END)::numeric AS linked_quantity
        FROM stock_movement_lots AS sml
        INNER JOIN stock_movements AS sm
          ON sm.id = sml.stock_movement_id
         AND sm.tenant_id = sml.tenant_id
        WHERE sml.tenant_id = $1
        GROUP BY sml.tenant_id, sm.branch_id, sml.product_id
      )
      SELECT
        'LOT_REQUIRED_PRODUCT_WITH_NON_LOTTED_STOCK'::text AS discrepancy_type,
        aggregate_stock.tenant_id,
        aggregate_stock.branch_id,
        aggregate_stock.product_id,
        NULL::uuid AS lot_id,
        NULL::uuid AS stock_movement_id,
        NULL::uuid AS stock_movement_lot_id,
        NULL::uuid AS balance_id,
        aggregate_stock.stock_quantity::numeric AS expected_quantity,
        COALESCE(linked_stock.linked_quantity, 0)::numeric AS actual_quantity,
        (aggregate_stock.stock_quantity - COALESCE(linked_stock.linked_quantity, 0))::numeric AS quantity_delta,
        'lot-required product has stock not covered by stock_movement_lots' AS message,
        NOW() AS detected_at
      FROM aggregate_stock
      LEFT JOIN linked_stock
        ON linked_stock.tenant_id = aggregate_stock.tenant_id
       AND linked_stock.branch_id = aggregate_stock.branch_id
       AND linked_stock.product_id = aggregate_stock.product_id
      WHERE __WHERE__
        AND aggregate_stock.stock_quantity <> COALESCE(linked_stock.linked_quantity, 0)
      `,
      ["aggregate_stock.tenant_id = $1"],
      {
        branchId: "aggregate_stock.branch_id",
        productId: "aggregate_stock.product_id",
      }
    );

    const query = `
      SELECT *
      FROM (
        ${parts.join("\n        UNION ALL\n")}
      ) AS discrepancies
      ORDER BY discrepancy_type ASC, product_id ASC NULLS LAST, lot_id ASC NULLS LAST
    `;

    const result = await this.db.query<DiscrepancyRow>(query, params);
    return result.rows.map((row) => this.mapDiscrepancy(row));
  }

  async getProductReconciliation(
    tenantId: string,
    productId: string,
    filters: InventoryLotReconciliationFilters = {}
  ) {
    const params: unknown[] = [tenantId, productId];
    const movementClauses = ["sm.tenant_id = $1", "sm.product_id = $2"];
    const lotClauses = ["lot.tenant_id = $1", "lot.product_id = $2"];
    const balanceClauses = ["balance.tenant_id = $1", "balance.product_id = $2"];
    const linkClauses = ["sml.tenant_id = $1", "sml.product_id = $2"];

    if (filters.branchId) {
      params.push(filters.branchId);
      movementClauses.push(`sm.branch_id = $${params.length}`);
      lotClauses.push(`lot.branch_id = $${params.length}`);
      balanceClauses.push(`balance.branch_id = $${params.length}`);
      linkClauses.push(`COALESCE(sm.branch_id, lot.branch_id) = $${params.length}`);
    }

    const result = await this.db.query<ProductReconciliationRow>(
      `
      SELECT
        product.id AS product_id,
        product.requires_lot,
        (
          SELECT COALESCE(SUM(CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE -sm.quantity END), 0)
          FROM stock_movements AS sm
          WHERE ${movementClauses.join(" AND ")}
        ) AS aggregate_stock_quantity,
        (
          SELECT COALESCE(SUM(CASE WHEN sm.type = 'IN' THEN sml.quantity ELSE -sml.quantity END), 0)
          FROM stock_movement_lots AS sml
          INNER JOIN stock_movements AS sm ON sm.id = sml.stock_movement_id
          LEFT JOIN inventory_lots AS lot ON lot.id = sml.lot_id
          WHERE ${linkClauses.join(" AND ")}
        ) AS linked_quantity,
        (
          SELECT COALESCE(SUM(balance.quantity_on_hand), 0)
          FROM inventory_lot_balances AS balance
          WHERE ${balanceClauses.join(" AND ")}
        ) AS balance_quantity,
        (
          SELECT COUNT(*)
          FROM inventory_lots AS lot
          WHERE ${lotClauses.join(" AND ")}
        ) AS lot_count,
        (
          SELECT COUNT(*)
          FROM inventory_lot_balances AS balance
          WHERE ${balanceClauses.join(" AND ")}
        ) AS balance_count,
        (
          SELECT COUNT(*)
          FROM stock_movements AS sm
          WHERE ${movementClauses.join(" AND ")}
        ) AS movement_count,
        (
          SELECT COUNT(*)
          FROM stock_movement_lots AS sml
          INNER JOIN stock_movements AS sm ON sm.id = sml.stock_movement_id
          LEFT JOIN inventory_lots AS lot ON lot.id = sml.lot_id
          WHERE ${linkClauses.join(" AND ")}
        ) AS link_count
      FROM products AS product
      WHERE product.tenant_id = $1 AND product.id = $2
      LIMIT 1
      `,
      params
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      productId: row.product_id,
      requiresLot: row.requires_lot,
      aggregateStockQuantity: this.toNumber(row.aggregate_stock_quantity),
      linkedQuantity: this.toNumber(row.linked_quantity),
      balanceQuantity: this.toNumber(row.balance_quantity),
      lotCount: this.toNumber(row.lot_count),
      balanceCount: this.toNumber(row.balance_count),
      movementCount: this.toNumber(row.movement_count),
      linkCount: this.toNumber(row.link_count),
    };
  }

  async getLotReconciliation(
    tenantId: string,
    lotId: string,
    filters: InventoryLotReconciliationFilters = {}
  ) {
    const params: unknown[] = [tenantId, lotId];
    const branchFilter = filters.branchId
      ? (params.push(filters.branchId), ` AND lot.branch_id = $${params.length}`)
      : "";

    const result = await this.db.query<LotReconciliationRow>(
      `
      SELECT
        lot.id AS lot_id,
        lot.branch_id,
        lot.product_id,
        lot.status,
        lot.expiration_date,
        (
          SELECT COALESCE(SUM(CASE WHEN sm.type = 'IN' THEN sml.quantity ELSE -sml.quantity END), 0)
          FROM stock_movement_lots AS sml
          INNER JOIN stock_movements AS sm
            ON sm.id = sml.stock_movement_id
           AND sm.tenant_id = sml.tenant_id
          WHERE sml.tenant_id = $1 AND sml.lot_id = $2
        ) AS linked_quantity,
        (
          SELECT COALESCE(SUM(balance.quantity_on_hand), 0)
          FROM inventory_lot_balances AS balance
          WHERE balance.tenant_id = $1 AND balance.lot_id = $2
        ) AS balance_quantity,
        (
          SELECT COALESCE(SUM(balance.quantity_available), 0)
          FROM inventory_lot_balances AS balance
          WHERE balance.tenant_id = $1 AND balance.lot_id = $2
        ) AS balance_available_quantity,
        (
          SELECT COUNT(*)
          FROM inventory_lot_balances AS balance
          WHERE balance.tenant_id = $1 AND balance.lot_id = $2
        ) AS balance_count,
        (
          SELECT COUNT(*)
          FROM stock_movement_lots AS sml
          WHERE sml.tenant_id = $1 AND sml.lot_id = $2
        ) AS link_count
      FROM inventory_lots AS lot
      WHERE lot.tenant_id = $1 AND lot.id = $2${branchFilter}
      LIMIT 1
      `,
      params
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      lotId: row.lot_id,
      branchId: row.branch_id,
      productId: row.product_id,
      status: row.status,
      expirationDate: row.expiration_date ? new Date(row.expiration_date) : null,
      linkedQuantity: this.toNumber(row.linked_quantity),
      balanceQuantity: this.toNumber(row.balance_quantity),
      balanceAvailableQuantity: this.toNumber(row.balance_available_quantity),
      balanceCount: this.toNumber(row.balance_count),
      linkCount: this.toNumber(row.link_count),
    };
  }
}
