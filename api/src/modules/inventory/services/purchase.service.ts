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
import {
  PurchaseEntity,
  type PurchaseStatus,
  type PurchaseType,
} from "../entities/purchase.entity";
import { StockMovementService } from "./stock-movement.service";

type CreatePurchaseItemInput = {
  id?: string;
  productId: string;
  quantity?: number;
  orderedQuantity?: number;
  receivedQuantity?: number;
  cost: number;
  subtotal: number;
};

type CreatePurchaseInput = {
  tenantId: string;
  supplierId: string;
  type?: PurchaseType;
  total: number;
  balance?: number;
  items: CreatePurchaseItemInput[];
};

type UpdatePurchaseInput = Partial<{
  supplierId: string;
  type: PurchaseType;
  total: number;
  balance: number;
  status: Extract<PurchaseStatus, "DRAFT" | "PENDING">;
  items: CreatePurchaseItemInput[];
}>;

type ReceivePurchaseItemInput = {
  productId: string;
  quantity: number;
};

type PurchaseRow = {
  id: string;
  tenant_id: string;
  supplier_id: string;
  type: PurchaseType;
  status: PurchaseStatus;
  total: string | number;
  balance: string | number;
  created_at: string | Date;
};

type PurchaseListRow = PurchaseRow & {
  supplier_name: string | null;
};

type PurchaseItemRow = {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name?: string | null;
  quantity?: string | number | null;
  ordered_quantity?: string | number | null;
  received_quantity?: string | number | null;
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
      type: row.type,
      status: row.status,
      total: Number(row.total),
      balance: Number(row.balance ?? 0),
      createdAt: new Date(row.created_at),
    });
  }

  private mapPurchaseItem(row: PurchaseItemRow) {
    const orderedQuantity = Number(
      row.ordered_quantity ?? row.quantity ?? 0
    );
    const receivedQuantity = Number(row.received_quantity ?? 0);

    return PurchaseItemEntity.create({
      id: row.id,
      purchaseId: row.purchase_id,
      productId: row.product_id,
      orderedQuantity,
      receivedQuantity,
      cost: Number(row.cost),
      subtotal: Number(row.subtotal),
    });
  }

  private mapPurchaseWithItems(
    purchaseRow: PurchaseRow,
    itemRows: PurchaseItemRow[]
  ) {
    return {
      ...this.mapPurchase(purchaseRow),
      items: itemRows.map((row) => ({
        ...this.mapPurchaseItem(row),
        productName: row.product_name ?? null,
      })),
    };
  }

  private assertItems(items: CreatePurchaseItemInput[] | undefined) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException("purchase items are required");
    }
  }

  private normalizeItems(items: CreatePurchaseItemInput[], purchaseId: string) {
    return items.map((item) =>
      PurchaseItemEntity.create({
        id: item.id ?? crypto.randomUUID(),
        purchaseId,
        productId: item.productId,
        orderedQuantity: item.orderedQuantity ?? item.quantity ?? 0,
        receivedQuantity: item.receivedQuantity ?? 0,
        cost: item.cost,
        subtotal: item.subtotal,
      })
    );
  }

  private resolveBalance(type: PurchaseType, total: number) {
    if (!Number.isFinite(total) || total < 0) {
      throw new BadRequestException("total must be a non-negative number");
    }

    // For now balance is fully derived from the purchase type.
    // Future payment flows can decrease this value over time.
    return type === "CREDIT" ? total : 0;
  }

  private resolveStatusFromItems(
    items: Array<Pick<PurchaseItemEntity, "orderedQuantity" | "receivedQuantity">>
  ): PurchaseStatus {
    if (items.length === 0) {
      return "PENDING";
    }

    const allZero = items.every((item) => item.receivedQuantity === 0);
    if (allZero) {
      return "PENDING";
    }

    const allComplete = items.every(
      (item) => item.receivedQuantity === item.orderedQuantity
    );
    if (allComplete) {
      return "RECEIVED";
    }

    return "PARTIAL";
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

  private async replaceItems(
    purchaseId: string,
    items: PurchaseItemEntity[],
    client: PoolClient
  ) {
    await client.query(`DELETE FROM purchase_items WHERE purchase_id = $1`, [purchaseId]);

    for (const item of items) {
      await client.query(
        `
          INSERT INTO purchase_items (
            id,
            purchase_id,
            product_id,
            ordered_quantity,
            received_quantity,
            cost,
            subtotal
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          )
        `,
        [
          item.id,
          item.purchaseId,
          item.productId,
          item.orderedQuantity,
          item.receivedQuantity,
          item.cost,
          item.subtotal,
        ]
      );
    }
  }

  async createPurchase(data: CreatePurchaseInput) {
    this.assertItems(data.items);

    const purchaseId = crypto.randomUUID();
    const purchaseType = data.type ?? "CASH";
    const purchaseBalance = this.resolveBalance(purchaseType, data.total);
    const purchase = PurchaseEntity.create({
      id: purchaseId,
      tenantId: data.tenantId,
      supplierId: data.supplierId,
      type: purchaseType,
      status: "DRAFT",
      total: data.total,
      balance: purchaseBalance,
      createdAt: new Date(),
    });

    const items = this.normalizeItems(data.items, purchase.id);

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
            type,
            status,
            total,
            balance,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          )
          RETURNING
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            created_at
        `,
        [
          purchase.id,
          purchase.tenantId,
          purchase.supplierId,
          purchase.type,
          purchase.status,
          purchase.total,
          purchase.balance,
          purchase.createdAt,
        ]
      );

      await this.replaceItems(purchase.id, items, client);

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

  async updatePurchase(id: string, tenantId: string, data: UpdatePurchaseInput) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const currentResult = await client.query<PurchaseRow>(
        `
          SELECT
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            created_at
          FROM purchases
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
        `,
        [id, tenantId]
      );

      const current = currentResult.rows[0];
      if (!current) {
        throw new NotFoundException("purchase not found");
      }
      if (current.status === "RECEIVED") {
        throw new BadRequestException("received purchases cannot be updated");
      }
      if (current.status === "CANCELLED") {
        throw new BadRequestException("cancelled purchases cannot be updated");
      }

      if (data.items) {
        this.assertItems(data.items);
        await this.ensureProductsBelongToTenant(data.items, tenantId, client);
      }

      const nextType = data.type ?? current.type;
      const nextTotal =
        data.total !== undefined ? data.total : Number(current.total);
      const nextBalance = this.resolveBalance(nextType, nextTotal);
      const nextStatus = data.status ?? current.status;

      const updateResult = await client.query<PurchaseRow>(
        `
          UPDATE purchases
          SET
            supplier_id = COALESCE($3, supplier_id),
            type = COALESCE($4, type),
            status = COALESCE($5, status),
            total = COALESCE($6, total),
            balance = COALESCE($7, balance)
          WHERE id = $1 AND tenant_id = $2
          RETURNING
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            created_at
        `,
        [
          id,
          tenantId,
          data.supplierId ?? null,
          nextType,
          nextStatus,
          nextTotal,
          nextBalance,
        ]
      );

      let items: PurchaseItemEntity[] = [];
      if (data.items) {
        items = this.normalizeItems(data.items, id);
        await this.replaceItems(id, items, client);
      } else {
        const itemsResult = await client.query<PurchaseItemRow>(
          `
            SELECT
              id,
              purchase_id,
              product_id,
              ordered_quantity,
              received_quantity,
              cost,
              subtotal
            FROM purchase_items
            WHERE purchase_id = $1
            ORDER BY id
          `,
          [id]
        );
        items = itemsResult.rows.map((row) => this.mapPurchaseItem(row));
      }

      await client.query("COMMIT");

      return {
        ...this.mapPurchase(updateResult.rows[0]),
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
    const result = await this.db.query<PurchaseListRow>(
      `
        SELECT
          p.id,
          p.tenant_id,
          p.supplier_id,
          p.type,
          p.status,
          p.total,
          p.balance,
          p.created_at,
          s.name AS supplier_name
        FROM purchases p
        LEFT JOIN suppliers s
          ON s.id = p.supplier_id
         AND s.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1
        ORDER BY p.created_at DESC
      `,
      [tenantId]
    );

    return result.rows.map((row) => ({
      ...this.mapPurchase(row),
      supplierName: row.supplier_name,
    }));
  }

  async getPurchaseById(id: string, tenantId: string) {
    const purchaseResult = await this.db.query<PurchaseRow>(
      `
        SELECT
          id,
          tenant_id,
          supplier_id,
          type,
          status,
          total,
          balance,
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

    const itemsResult = await this.db.query<PurchaseItemRow>(
      `
        SELECT
          pi.id,
          pi.purchase_id,
          pi.product_id,
          p.name AS product_name,
          pi.ordered_quantity,
          pi.received_quantity,
          pi.cost,
          pi.subtotal
        FROM purchase_items pi
        INNER JOIN products p
          ON p.id = pi.product_id
         AND p.tenant_id = $2
        WHERE pi.purchase_id = $1
        ORDER BY p.name ASC, pi.id ASC
      `,
      [id, tenantId]
    );

    return this.mapPurchaseWithItems(purchaseRow, itemsResult.rows);
  }

  async receivePurchase(
    id: string,
    tenantId: string,
    itemsToReceive: ReceivePurchaseItemInput[]
  ) {
    if (!Array.isArray(itemsToReceive) || itemsToReceive.length === 0) {
      throw new BadRequestException("receive items are required");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const purchaseResult = await client.query<PurchaseRow>(
        `
          SELECT
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
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
      if (purchaseRow.status === "CANCELLED") {
        throw new BadRequestException("cancelled purchases cannot be received");
      }

      const itemsResult = await client.query<PurchaseItemRow>(
        `
            SELECT
              id,
              purchase_id,
              product_id,
              ordered_quantity,
              received_quantity,
              cost,
              subtotal
          FROM purchase_items
          WHERE purchase_id = $1
          ORDER BY id
        `,
        [id]
      );

      const items = itemsResult.rows.map((row) => this.mapPurchaseItem(row));
      if (items.length === 0) {
        throw new BadRequestException("purchase items are required");
      }

      const itemsByProductId = new Map<string, PurchaseItemEntity[]>();
      for (const item of items) {
        const currentItems = itemsByProductId.get(item.productId) ?? [];
        currentItems.push(item);
        itemsByProductId.set(item.productId, currentItems);
      }

      const pendingByItemId = new Map(
        items.map((item) => [item.id, item.orderedQuantity - item.receivedQuantity])
      );

      for (const receiveItem of itemsToReceive) {
        const productId = receiveItem.productId;
        if (!productId) {
          throw new BadRequestException("productId is required");
        }

        const quantity = Number(receiveItem.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new BadRequestException("received quantity must be a positive number");
        }

        const productItems = itemsByProductId.get(productId) ?? [];
        if (productItems.length === 0) {
          throw new BadRequestException("purchase item not found for product");
        }

        const totalPendingQuantity = productItems.reduce(
          (sum, item) => sum + (pendingByItemId.get(item.id) ?? 0),
          0
        );
        if (quantity > totalPendingQuantity) {
          throw new BadRequestException(
            "received quantity exceeds pending ordered quantity"
          );
        }

        await this.stockMovementService.createMovement(
          {
            id: crypto.randomUUID(),
            tenantId,
            productId,
            type: "IN",
            quantity,
            referenceType: "PURCHASE",
            referenceId: id,
            createdAt: new Date(),
          },
          client
        );

        let remainingQuantity = quantity;
        for (const item of productItems) {
          if (remainingQuantity <= 0) {
            break;
          }

          const itemPendingQuantity = pendingByItemId.get(item.id) ?? 0;
          if (itemPendingQuantity <= 0) {
            continue;
          }

          const receivedDelta = Math.min(remainingQuantity, itemPendingQuantity);
          pendingByItemId.set(item.id, itemPendingQuantity - receivedDelta);
          remainingQuantity -= receivedDelta;

          await client.query(
            `
              UPDATE purchase_items
              SET received_quantity = received_quantity + $2
              WHERE id = $1
            `,
            [item.id, receivedDelta]
          );
        }
      }

      const updatedItemsResult = await client.query<PurchaseItemRow>(
        `
          SELECT
            id,
            purchase_id,
            product_id,
            ordered_quantity,
            received_quantity,
            cost,
            subtotal
          FROM purchase_items
          WHERE purchase_id = $1
          ORDER BY id
        `,
        [id]
      );

      const updatedItems = updatedItemsResult.rows.map((row) =>
        this.mapPurchaseItem(row)
      );
      const nextStatus = this.resolveStatusFromItems(updatedItems);

      const updatedPurchaseResult = await client.query<PurchaseRow>(
        `
          UPDATE purchases
          SET status = $3
          WHERE id = $1 AND tenant_id = $2
          RETURNING
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            created_at
        `,
        [id, tenantId, nextStatus]
      );

      await client.query("COMMIT");

      return {
        ...this.mapPurchase(updatedPurchaseResult.rows[0]),
        items: updatedItems,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelPurchase(id: string, tenantId: string) {
    const result = await this.db.query<PurchaseRow>(
      `
        UPDATE purchases
        SET status = 'CANCELLED'
        WHERE id = $1
          AND tenant_id = $2
          AND status <> 'RECEIVED'
        RETURNING
          id,
          tenant_id,
          supplier_id,
          type,
          status,
          total,
          balance,
          created_at
      `,
      [id, tenantId]
    );

    if (!result.rows[0]) {
      const existing = await this.db.query<PurchaseRow>(
        `
          SELECT
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            created_at
          FROM purchases
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
        `,
        [id, tenantId]
      );

      if (!existing.rows[0]) {
        throw new NotFoundException("purchase not found");
      }
      if (existing.rows[0].status === "RECEIVED") {
        throw new BadRequestException("received purchases cannot be cancelled");
      }
    }

    return this.mapPurchase(result.rows[0]);
  }
}
