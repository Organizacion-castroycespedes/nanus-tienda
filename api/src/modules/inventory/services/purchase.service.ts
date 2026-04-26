import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { PurchaseItemEntity } from "../entities/purchase-item.entity";
import { PurchaseEntity } from "../entities/purchase.entity";
import { StockMovementService } from "./stock-movement.service";

type CreatePurchaseItemInput = {
  id: string;
  productId: string;
  quantity: number;
  cost: number;
  subtotal: number;
};

type CreatePurchaseInput = {
  id: string;
  tenantId: string;
  supplierId: string;
  total: number;
  createdAt: Date;
  items: CreatePurchaseItemInput[];
};

type PurchaseRow = {
  id: string;
  tenant_id: string;
  supplier_id: string;
  status: "PENDING" | "RECEIVED" | "CANCELLED";
  total: string | number;
  created_at: string | Date;
};

type PurchaseItemRow = {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: string | number;
  cost: string | number;
  subtotal: string | number;
};

type ProductRow = {
  id: string;
};

@Injectable()
export class PurchaseService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService
  ) {}

  private mapPurchase(row: PurchaseRow) {
    return PurchaseEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      supplierId: row.supplier_id,
      status: row.status,
      total: Number(row.total),
      createdAt: new Date(row.created_at),
    });
  }

  private mapPurchaseItem(row: PurchaseItemRow) {
    return PurchaseItemEntity.create({
      id: row.id,
      purchaseId: row.purchase_id,
      productId: row.product_id,
      quantity: Number(row.quantity),
      cost: Number(row.cost),
      subtotal: Number(row.subtotal),
    });
  }

  private async ensureProductsBelongToTenant(
    items: CreatePurchaseItemInput[],
    tenantId: string,
    client: PoolClient
  ) {
    for (const item of items) {
      const product = await client.query<ProductRow>(
        `
        SELECT id
        FROM products
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [item.productId, tenantId]
      );

      if (!product.rows[0]) {
        throw new BadRequestException("product not found for tenant");
      }
    }
  }

  async createPurchase(data: CreatePurchaseInput) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException("purchase items are required");
    }

    const purchase = PurchaseEntity.create({
      id: data.id,
      tenantId: data.tenantId,
      supplierId: data.supplierId,
      status: "PENDING",
      total: data.total,
      createdAt: data.createdAt,
    });

    const items = (data.items ?? []).map((item) =>
      PurchaseItemEntity.create({
        id: item.id,
        purchaseId: purchase.id,
        productId: item.productId,
        quantity: item.quantity,
        cost: item.cost,
        subtotal: item.subtotal,
      })
    );

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await this.ensureProductsBelongToTenant(data.items, purchase.tenantId, client);

      const purchaseResult = await client.query<PurchaseRow>(
        `
        INSERT INTO purchases (
          id,
          tenant_id,
          supplier_id,
          status,
          total,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        )
        RETURNING
          id,
          tenant_id,
          supplier_id,
          status,
          total,
          created_at
        `,
        [
          purchase.id,
          purchase.tenantId,
          purchase.supplierId,
          purchase.status,
          purchase.total,
          purchase.createdAt,
        ]
      );

      for (const item of items) {
        await client.query(
          `
          INSERT INTO purchase_items (
            id,
            purchase_id,
            product_id,
            quantity,
            cost,
            subtotal
          ) VALUES (
            $1, $2, $3, $4, $5, $6
          )
          `,
          [
            item.id,
            item.purchaseId,
            item.productId,
            item.quantity,
            item.cost,
            item.subtotal,
          ]
        );
      }

      await client.query("COMMIT");

      return {
        ...this.mapPurchase(purchaseResult.rows[0]),
        items,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPurchases(tenantId: string) {
    const result = await this.db.query<PurchaseRow>(
      `
      SELECT
        id,
        tenant_id,
        supplier_id,
        status,
        total,
        created_at
      FROM purchases
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      `,
      [tenantId]
    );

    return result.rows.map((row) => this.mapPurchase(row));
  }

  async receivePurchase(id: string, tenantId: string) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const purchaseResult = await client.query<PurchaseRow>(
        `
        SELECT
          id,
          tenant_id,
          supplier_id,
          status,
          total,
          created_at
        FROM purchases
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [id, tenantId]
      );

      const purchaseRow = purchaseResult.rows[0];
      if (!purchaseRow) {
        throw new NotFoundException("purchase not found");
      }
      if (purchaseRow.status === "RECEIVED") {
        throw new BadRequestException("purchase already received");
      }
      if (purchaseRow.status !== "PENDING") {
        throw new BadRequestException("only pending purchases can be received");
      }

      const itemsResult = await client.query<PurchaseItemRow>(
        `
        SELECT
          id,
          purchase_id,
          product_id,
          quantity,
          cost,
          subtotal
        FROM purchase_items
        WHERE purchase_id = $1
        ORDER BY id
        `,
        [id]
      );

      const items = itemsResult.rows.map((row) => this.mapPurchaseItem(row));

      await client.query(
        `
        UPDATE purchases
        SET status = 'RECEIVED'
        WHERE id = $1 AND tenant_id = $2
        `,
        [id, tenantId]
      );

      for (const item of items) {
        await this.stockMovementService.createMovement(
          {
            id: crypto.randomUUID(),
            tenantId,
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            referenceType: "PURCHASE",
            referenceId: id,
            createdAt: new Date(),
          },
          client
        );
      }

      await client.query("COMMIT");

      return PurchaseEntity.create({
        id: purchaseRow.id,
        tenantId: purchaseRow.tenant_id,
        supplierId: purchaseRow.supplier_id,
        status: "RECEIVED",
        total: Number(purchaseRow.total),
        createdAt: new Date(purchaseRow.created_at),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
