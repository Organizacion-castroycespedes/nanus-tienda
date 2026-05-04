import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { AuditService } from "../../../common/services/audit.service";
import {
  StockMovementEntity,
  type StockMovementProps,
} from "../entities/stock-movement.entity";

type StockMovementRow = {
  id: string;
  tenant_id: string;
  product_id: string;
  type: "IN" | "OUT";
  quantity: string | number;
  reference_type: "PURCHASE" | "SALE" | "ADJUSTMENT";
  reference_id: string;
  branch_id: string | null;
  terminal_id: string | null;
  pos_session_code: string | null;
  user_id: string | null;
  reference_table: string | null;
  stock_before: string | number | null;
  stock_after: string | number | null;
  created_at: string | Date;
};

type StockBalanceRow = {
  stock: string | number | null;
};

export type InventoryContext = {
  tenantId: string;
  branchId?: string | null;
  terminalId?: string | null;
  posSessionId?: string | null;
  userId?: string | null;
};

@Injectable()
export class StockMovementService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  private async query<T extends QueryResultRow>(
    text: string,
    params: unknown[],
    client?: PoolClient
  ) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query<T>(text, params);
  }

  private defaultReferenceTable(referenceType: StockMovementProps["referenceType"]) {
    switch (referenceType) {
      case "PURCHASE":
        return "purchases";
      case "SALE":
        return "sales";
      case "ADJUSTMENT":
        return "stock_adjustments";
      default:
        return "stock_movements";
    }
  }

  private toNumber(value: string | number | null | undefined) {
    if (value == null) {
      return 0;
    }
    return typeof value === "number" ? value : Number(value);
  }

  private async getCurrentStock(
    productId: string,
    tenantId: string,
    branchId?: string | null,
    client?: PoolClient
  ) {
    const params: unknown[] = [productId, tenantId];
    let branchFilter = "";

    if (branchId) {
      params.push(branchId);
      branchFilter = ` AND branch_id = $${params.length}`;
    }

    const result = await this.query<StockBalanceRow>(
      `
      SELECT
        COALESCE(SUM(quantity) FILTER (WHERE type = 'IN'), 0)
        - COALESCE(SUM(quantity) FILTER (WHERE type = 'OUT'), 0) AS stock
      FROM stock_movements
      WHERE product_id = $1 AND tenant_id = $2${branchFilter}
      `,
      params,
      client
    );

    return this.toNumber(result.rows[0]?.stock);
  }

  logMovementAuditEvent(movement: StockMovementEntity) {
    this.auditService.logEvent({
      tenantId: movement.tenantId,
      userId: movement.userId,
      module: "inventory",
      entity: "stock_movements",
      entityId: movement.id,
      action: movement.type === "IN" ? "STOCK_IN" : "STOCK_OUT",
      after: {
        productId: movement.productId,
        quantity: movement.quantity,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        referenceTable: movement.referenceTable,
        branchId: movement.branchId,
        terminalId: movement.terminalId,
        posSessionCode: movement.posSessionCode,
        stockBefore: movement.stockBefore,
        stockAfter: movement.stockAfter,
      },
    });
  }

  async createMovement(data: StockMovementProps, client?: PoolClient) {
    const product = await this.query<{ id: string }>(
      `
      SELECT id
      FROM products
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [data.productId, data.tenantId],
      client
    );

    if (!product.rows[0]) {
      throw new BadRequestException("product not found for tenant");
    }

    const stockBefore =
      data.stockBefore ??
      (await this.getCurrentStock(
        data.productId,
        data.tenantId,
        data.branchId ?? null,
        client
      ));
    const delta = data.type === "IN" ? data.quantity : -data.quantity;
    const stockAfter = data.stockAfter ?? stockBefore + delta;

    if (data.type === "OUT" && stockAfter < 0) {
      throw new BadRequestException("insufficient stock for branch");
    }

    const movement = StockMovementEntity.create({
      ...data,
      posSessionCode: data.posSessionCode ?? null,
      referenceTable:
        data.referenceTable ?? this.defaultReferenceTable(data.referenceType),
      stockBefore,
      stockAfter,
    });

    const result = await this.query<StockMovementRow>(
      `
      INSERT INTO stock_movements (
        id,
        tenant_id,
        product_id,
        type,
        quantity,
        reference_type,
        reference_id,
        branch_id,
        terminal_id,
        pos_session_code,
        user_id,
        reference_table,
        stock_before,
        stock_after,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING
        id,
        tenant_id,
        product_id,
        type,
        quantity,
        reference_type,
        reference_id,
        branch_id,
        terminal_id,
        pos_session_code,
        user_id,
        reference_table,
        stock_before,
        stock_after,
        created_at
      `,
      [
        movement.id,
        movement.tenantId,
        movement.productId,
        movement.type,
        movement.quantity,
        movement.referenceType,
        movement.referenceId,
        movement.branchId,
        movement.terminalId,
        movement.posSessionCode,
        movement.userId,
        movement.referenceTable,
        movement.stockBefore,
        movement.stockAfter,
        movement.createdAt,
      ],
      client
    );

    const row = result.rows[0];
    const createdMovement = StockMovementEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      type: row.type,
      quantity: Number(row.quantity),
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      branchId: row.branch_id,
      terminalId: row.terminal_id,
      posSessionCode: row.pos_session_code,
      userId: row.user_id,
      referenceTable: row.reference_table,
      stockBefore: this.toNumber(row.stock_before),
      stockAfter: this.toNumber(row.stock_after),
      createdAt: new Date(row.created_at),
    });

    if (!client) {
      this.logMovementAuditEvent(createdMovement);
    }

    return createdMovement;
  }

  async getStockByProduct(productId: string, tenantId: string, branchId?: string | null) {
    return {
      productId,
      tenantId,
      branchId: branchId ?? null,
      stock: await this.getCurrentStock(productId, tenantId, branchId ?? null),
    };
  }
}
