import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
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
  created_at: string | Date;
};

type StockBalanceRow = {
  stock: string | number | null;
};

@Injectable()
export class StockMovementService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
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

  async createMovement(data: StockMovementProps, client?: PoolClient) {
    const movement = StockMovementEntity.create(data);

    const product = await this.query<{ id: string }>(
      `
      SELECT id
      FROM products
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [movement.productId, movement.tenantId],
      client
    );

    if (!product.rows[0]) {
      throw new BadRequestException("product not found for tenant");
    }

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
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING
        id,
        tenant_id,
        product_id,
        type,
        quantity,
        reference_type,
        reference_id,
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
        movement.createdAt,
      ],
      client
    );

    const row = result.rows[0];
    return StockMovementEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      type: row.type,
      quantity: Number(row.quantity),
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      createdAt: new Date(row.created_at),
    });
  }

  async getStockByProduct(productId: string, tenantId: string) {
    const result = await this.db.query<StockBalanceRow>(
      `
      SELECT
        COALESCE(SUM(quantity) FILTER (WHERE type = 'IN'), 0)
        - COALESCE(SUM(quantity) FILTER (WHERE type = 'OUT'), 0) AS stock
      FROM stock_movements
      WHERE product_id = $1 AND tenant_id = $2
      `,
      [productId, tenantId]
    );

    return {
      productId,
      tenantId,
      stock: Number(result.rows[0]?.stock ?? 0),
    };
  }
}
