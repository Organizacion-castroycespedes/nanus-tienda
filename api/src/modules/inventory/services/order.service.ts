import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { OrderItemEntity } from "../entities/order-item.entity";
import { OrderEntity, type OrderStatus, type OrderType } from "../entities/order.entity";

type CreateOrderItemInput = {
  id?: string;
  productId: string;
  quantity?: number;
  orderedQuantity?: number;
  deliveredQuantity?: number;
  price: number;
  subtotal: number;
};

type CreateOrderInput = {
  tenantId: string;
  customerId: string;
  type?: OrderType;
  total: number;
  items: CreateOrderItemInput[];
};

type UpdateOrderInput = Partial<{
  customerId: string;
  type: OrderType;
  total: number;
  status: Extract<OrderStatus, "DRAFT">;
  items: CreateOrderItemInput[];
}>;

type OrderRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  type: OrderType;
  status: OrderStatus;
  total: string | number;
  created_at: string | Date;
};

type OrderListRow = OrderRow & {
  customer_name: string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name?: string | null;
  ordered_quantity?: string | number | null;
  delivered_quantity?: string | number | null;
  price: string | number;
  subtotal: string | number;
};

type ProductRow = {
  id: string;
};

type CustomerRow = {
  id: string;
};

@Injectable()
export class OrderService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private mapOrder(row: OrderRow) {
    return OrderEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      type: row.type,
      status: row.status,
      total: Number(row.total),
      createdAt: new Date(row.created_at),
    });
  }

  private mapOrderItem(row: OrderItemRow) {
    return OrderItemEntity.create({
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      orderedQuantity: Number(row.ordered_quantity ?? 0),
      deliveredQuantity: Number(row.delivered_quantity ?? 0),
      price: Number(row.price),
      subtotal: Number(row.subtotal),
    });
  }

  private mapOrderWithItems(orderRow: OrderRow, itemRows: OrderItemRow[]) {
    return {
      ...this.mapOrder(orderRow),
      items: itemRows.map((row) => ({
        ...this.mapOrderItem(row),
        productName: row.product_name ?? null,
      })),
    };
  }

  private assertItems(items: CreateOrderItemInput[] | undefined) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException("order items are required");
    }
  }

  private normalizeItems(items: CreateOrderItemInput[], orderId: string) {
    return items.map((item) =>
      OrderItemEntity.create({
        id: item.id ?? crypto.randomUUID(),
        orderId,
        productId: item.productId,
        orderedQuantity: item.orderedQuantity ?? item.quantity ?? 0,
        deliveredQuantity: item.deliveredQuantity ?? 0,
        price: item.price,
        subtotal: item.subtotal,
      })
    );
  }

  private async ensureCustomerBelongsToTenant(
    customerId: string,
    tenantId: string,
    client: PoolClient
  ) {
    const result = await client.query<CustomerRow>(
      `
        SELECT id
        FROM customers
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [customerId, tenantId]
    );

    if (!result.rows[0]) {
      throw new BadRequestException("customer not found for tenant");
    }
  }

  private async ensureProductsBelongToTenant(
    items: CreateOrderItemInput[],
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
    orderId: string,
    items: OrderItemEntity[],
    client: PoolClient
  ) {
    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);

    for (const item of items) {
      await client.query(
        `
          INSERT INTO order_items (
            id,
            order_id,
            product_id,
            ordered_quantity,
            delivered_quantity,
            price,
            subtotal
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          )
        `,
        [
          item.id,
          item.orderId,
          item.productId,
          item.orderedQuantity,
          item.deliveredQuantity,
          item.price,
          item.subtotal,
        ]
      );
    }
  }

  async createOrder(data: CreateOrderInput) {
    this.assertItems(data.items);

    const order = OrderEntity.create({
      id: crypto.randomUUID(),
      tenantId: data.tenantId,
      customerId: data.customerId,
      type: data.type ?? "CASH",
      status: "DRAFT",
      total: data.total,
      createdAt: new Date(),
    });

    const items = this.normalizeItems(data.items, order.id);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await this.ensureCustomerBelongsToTenant(order.customerId, order.tenantId, client);
      await this.ensureProductsBelongToTenant(data.items, order.tenantId, client);

      const orderResult = await client.query<OrderRow>(
        `
          INSERT INTO orders (
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          )
          RETURNING
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            created_at
        `,
        [
          order.id,
          order.tenantId,
          order.customerId,
          order.type,
          order.status,
          order.total,
          order.createdAt,
        ]
      );

      await this.replaceItems(order.id, items, client);
      await client.query("COMMIT");

      return {
        ...this.mapOrder(orderResult.rows[0]),
        items,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateOrder(id: string, tenantId: string, data: UpdateOrderInput) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const currentResult = await client.query<OrderRow>(
        `
          SELECT
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            created_at
          FROM orders
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
        `,
        [id, tenantId]
      );

      const current = currentResult.rows[0];
      if (!current) {
        throw new NotFoundException("order not found");
      }
      if (current.status === "CONFIRMED") {
        throw new BadRequestException("confirmed orders cannot be updated");
      }
      if (current.status === "CANCELLED") {
        throw new BadRequestException("cancelled orders cannot be updated");
      }

      if (data.customerId) {
        await this.ensureCustomerBelongsToTenant(data.customerId, tenantId, client);
      }
      if (data.items) {
        this.assertItems(data.items);
        await this.ensureProductsBelongToTenant(data.items, tenantId, client);
      }

      const nextType = data.type ?? current.type;
      const nextTotal = data.total !== undefined ? data.total : Number(current.total);

      const updateResult = await client.query<OrderRow>(
        `
          UPDATE orders
          SET
            customer_id = COALESCE($3, customer_id),
            type = COALESCE($4, type),
            status = COALESCE($5, status),
            total = COALESCE($6, total)
          WHERE id = $1 AND tenant_id = $2
          RETURNING
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            created_at
        `,
        [id, tenantId, data.customerId ?? null, nextType, data.status ?? null, nextTotal]
      );

      let items: OrderItemEntity[] = [];
      if (data.items) {
        items = this.normalizeItems(data.items, id);
        await this.replaceItems(id, items, client);
      } else {
        const itemsResult = await client.query<OrderItemRow>(
          `
            SELECT
              id,
              order_id,
              product_id,
              ordered_quantity,
              delivered_quantity,
              price,
              subtotal
            FROM order_items
            WHERE order_id = $1
            ORDER BY id
          `,
          [id]
        );
        items = itemsResult.rows.map((row) => this.mapOrderItem(row));
      }

      await client.query("COMMIT");

      return {
        ...this.mapOrder(updateResult.rows[0]),
        items,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getOrders(tenantId: string) {
    const result = (await this.db.query(
      `
        SELECT
          o.id,
          o.tenant_id,
          o.customer_id,
          o.type,
          o.status,
          o.total,
          o.created_at,
          c.name AS customer_name
        FROM orders o
        LEFT JOIN customers c
          ON c.id = o.customer_id
         AND c.tenant_id = o.tenant_id
        WHERE o.tenant_id = $1
        ORDER BY o.created_at DESC
      `,
      [tenantId]
    )) as { rows: OrderListRow[] };

    return result.rows.map((row) => ({
      ...this.mapOrder(row),
      customerName: row.customer_name,
    }));
  }

  async getOrderById(id: string, tenantId: string) {
    const orderResult = (await this.db.query(
      `
        SELECT
          id,
          tenant_id,
          customer_id,
          type,
          status,
          total,
          created_at
        FROM orders
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId]
    )) as { rows: OrderRow[] };

    const orderRow = orderResult.rows[0];
    if (!orderRow) {
      throw new NotFoundException("order not found");
    }

    const itemsResult = (await this.db.query(
      `
        SELECT
          oi.id,
          oi.order_id,
          oi.product_id,
          p.name AS product_name,
          oi.ordered_quantity,
          oi.delivered_quantity,
          oi.price,
          oi.subtotal
        FROM order_items oi
        INNER JOIN products p
          ON p.id = oi.product_id
         AND p.tenant_id = $2
        WHERE oi.order_id = $1
        ORDER BY p.name ASC, oi.id ASC
      `,
      [id, tenantId]
    )) as { rows: OrderItemRow[] };

    return this.mapOrderWithItems(orderRow, itemsResult.rows);
  }

  async confirmOrder(id: string, tenantId: string) {
    const result = (await this.db.query(
      `
        UPDATE orders
        SET status = 'CONFIRMED'
        WHERE id = $1
          AND tenant_id = $2
          AND status = 'DRAFT'
        RETURNING
          id,
          tenant_id,
          customer_id,
          type,
          status,
          total,
          created_at
      `,
      [id, tenantId]
    )) as { rows: OrderRow[] };

    if (!result.rows[0]) {
      const existing = (await this.db.query(
        `
          SELECT
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            created_at
          FROM orders
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
        `,
        [id, tenantId]
      )) as { rows: OrderRow[] };

      if (!existing.rows[0]) {
        throw new NotFoundException("order not found");
      }
      if (existing.rows[0].status === "CONFIRMED") {
        throw new BadRequestException("order already confirmed");
      }
      if (existing.rows[0].status === "CANCELLED") {
        throw new BadRequestException("cancelled orders cannot be confirmed");
      }
    }

    return this.mapOrder(result.rows[0]);
  }

  async cancelOrder(id: string, tenantId: string) {
    const result = (await this.db.query(
      `
        UPDATE orders
        SET status = 'CANCELLED'
        WHERE id = $1
          AND tenant_id = $2
          AND status <> 'CANCELLED'
        RETURNING
          id,
          tenant_id,
          customer_id,
          type,
          status,
          total,
          created_at
      `,
      [id, tenantId]
    )) as { rows: OrderRow[] };

    if (!result.rows[0]) {
      const existing = (await this.db.query(
        `
          SELECT
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            created_at
          FROM orders
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
        `,
        [id, tenantId]
      )) as { rows: OrderRow[] };

      if (!existing.rows[0]) {
        throw new NotFoundException("order not found");
      }
      if (existing.rows[0].status === "CANCELLED") {
        throw new BadRequestException("order already cancelled");
      }
    }

    return this.mapOrder(result.rows[0]);
  }
}
