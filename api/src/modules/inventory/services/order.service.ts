import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { AuditService } from "../../../common/services/audit.service";
import { FinanceAccessRepository } from "../../finance/common/repositories/finance-access.repository";
import { PricingService } from "../../pricing/pricing.service";
import type { LinePricePreview } from "../../pricing/pricing.types";
import { OrderItemEntity } from "../entities/order-item.entity";
import { OrderEntity, type OrderStatus, type OrderType } from "../entities/order.entity";
import { SaleService } from "./sale.service";
import {
  StockMovementService,
  type InventoryContext,
} from "./stock-movement.service";
import {
  canViewAllBranches,
  hasBranchScopedRole,
  normalizeOptionalFilter,
  type BranchScopedActor,
  type BranchScopedFilters,
} from "../utils/access";

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
  branchId?: string;
  type?: OrderType;
  total: number;
  items: CreateOrderItemInput[];
  context?: InventoryContext;
  actor: BranchScopedActor;
};

type UpdateOrderInput = Partial<{
  customerId: string;
  branchId: string;
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
  payment_status: "PENDING" | "PARTIAL" | "PAID" | "OVERPAID";
  total_paid: string | number;
  balance_due: string | number;
  created_at: string | Date;
};

type OrderListRow = OrderRow & {
  tenant_name: string;
  customer_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  terminal_name: string | null;
  billing_status: "UNBILLED" | "PARTIAL" | "INVOICED";
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name?: string | null;
  ordered_quantity?: string | number | null;
  delivered_quantity?: string | number | null;
  billed_quantity?: string | number | null;
  price: string | number;
  subtotal: string | number;
  base_unit_price?: string | number | null;
  final_unit_price?: string | number | null;
  discount_amount?: string | number | null;
  discount_percent?: string | number | null;
  discount_total?: string | number | null;
  applied_promotion_id?: string | null;
  applied_promotion_name?: string | null;
  tax_id?: string | null;
  tax_rate?: string | number | null;
  tax_base?: string | number | null;
  tax_amount?: string | number | null;
  line_total?: string | number | null;
  pricing_snapshot?: Record<string, unknown> | string | null;
  pricing_calculated_at?: string | Date | null;
};

type OrderPaymentRow = {
  id: string;
  payment_method_id: string;
  payment_method_nombre: string | null;
  payment_method_tipo: string | null;
  cash_session_id: string | null;
  amount: string | number;
  reference_number: string | null;
  notes: string | null;
  order_allocated_amount: string | number;
  invoiced_amount: string | number;
  available_amount: string | number;
  created_at: string | Date;
};

type ProductRow = {
  id: string;
};

type CustomerRow = {
  id: string;
};

type BranchRow = {
  id: string;
};

type OrderAuditContextRow = {
  branch_id: string | null;
  branch_name: string | null;
  terminal_id: string | null;
  terminal_name: string | null;
};

@Injectable()
export class OrderService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(FinanceAccessRepository)
    private readonly financeAccessRepository: FinanceAccessRepository,
    @Inject(SaleService) private readonly saleService: SaleService,
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService,
    @Inject(PricingService)
    private readonly pricingService: PricingService
  ) {}

  private toNullableNumber(value: string | number | null | undefined) {
    return value === null || value === undefined ? null : Number(value);
  }

  private toNullableDate(value: string | Date | null | undefined) {
    return value === null || value === undefined ? null : new Date(value);
  }

  private toPricingSnapshot(
    value: Record<string, unknown> | string | null | undefined
  ) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "string") {
      return JSON.parse(value) as Record<string, unknown>;
    }
    return value;
  }

  private roundCurrency(value: number) {
    return Math.round((value + 1e-9) * 100) / 100;
  }

  private mapOrder(row: OrderRow) {
    return OrderEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      type: row.type,
      status: row.status,
      total: Number(row.total),
      paymentStatus: row.payment_status,
      totalPaid: Number(row.total_paid),
      balanceDue: Number(row.balance_due),
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
      billedQuantity: Number(row.billed_quantity ?? 0),
      price: Number(row.price),
      subtotal: Number(row.subtotal),
      baseUnitPrice: this.toNullableNumber(row.base_unit_price),
      finalUnitPrice: this.toNullableNumber(row.final_unit_price),
      discountAmount: this.toNullableNumber(row.discount_amount),
      discountPercent: this.toNullableNumber(row.discount_percent),
      discountTotal: this.toNullableNumber(row.discount_total),
      appliedPromotionId: row.applied_promotion_id ?? null,
      appliedPromotionName: row.applied_promotion_name ?? null,
      taxId: row.tax_id ?? null,
      taxRate: this.toNullableNumber(row.tax_rate),
      taxBase: this.toNullableNumber(row.tax_base),
      taxAmount: this.toNullableNumber(row.tax_amount),
      lineTotal: this.toNullableNumber(row.line_total),
      pricingSnapshot: this.toPricingSnapshot(row.pricing_snapshot),
      pricingCalculatedAt: this.toNullableDate(row.pricing_calculated_at),
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

  private async resolveAllowedBranchIds(
    actor: BranchScopedActor,
    tenantId: string
  ) {
    if (canViewAllBranches(actor)) {
      return undefined;
    }
    if (!actor.userId) {
      throw new ForbiddenException("Usuario requerido");
    }

    const branchIds = await this.financeAccessRepository.findAccessibleBranchIds(
      actor.userId,
      tenantId
    );

    if (branchIds.length > 0) {
      return branchIds;
    }
    if (actor.branchId) {
      return [actor.branchId];
    }

    throw new ForbiddenException("Usuario sin sucursales asignadas");
  }

  private async resolveOrderScope(
    actor: BranchScopedActor,
    filters: BranchScopedFilters
  ) {
    const tenantId = normalizeOptionalFilter(filters.tenantId);
    const branchId = normalizeOptionalFilter(filters.branchId);

    if (actor.roles.includes("SUPER_ADMIN")) {
      return { tenantId, branchId, branchIds: undefined as string[] | undefined };
    }

    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    if (tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }

    const resolvedTenantId = actor.tenantId;
    const allowedBranchIds = await this.resolveAllowedBranchIds(actor, resolvedTenantId);

    if (branchId && (allowedBranchIds?.length ?? 0) > 0 && !allowedBranchIds?.includes(branchId)) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }

    if (hasBranchScopedRole(actor) && actor.branchId) {
      if (branchId && branchId !== actor.branchId) {
        throw new ForbiddenException("No autorizado para otra sucursal");
      }

      return {
        tenantId: resolvedTenantId,
        branchId: actor.branchId,
        branchIds: [actor.branchId],
      };
    }

    return {
      tenantId: resolvedTenantId,
      branchId,
      branchIds: allowedBranchIds,
    };
  }

  private mapOrderPayment(row: OrderPaymentRow) {
    return {
      id: row.id,
      paymentMethodId: row.payment_method_id,
      paymentMethodNombre: row.payment_method_nombre,
      paymentMethodTipo: row.payment_method_tipo,
      cashSessionId: row.cash_session_id,
      amount: Number(row.amount),
      referenceNumber: row.reference_number,
      notes: row.notes,
      orderAllocatedAmount: Number(row.order_allocated_amount),
      invoicedAmount: Number(row.invoiced_amount),
      availableAmount: Number(row.available_amount),
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private assertItems(items: CreateOrderItemInput[] | undefined) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException("order items are required");
    }
  }

  private buildPricingSnapshot(input: {
    tenantId: string;
    branchId: string;
    customerId: string;
    pricingCalculatedAt: Date;
    preview: LinePricePreview;
  }) {
    return {
      channel: "ORDER",
      tenantId: input.tenantId,
      branchId: input.branchId,
      customerId: input.customerId,
      calculatedAt: input.pricingCalculatedAt.toISOString(),
      productId: input.preview.productId,
      quantity: input.preview.quantity,
      result: input.preview,
    };
  }

  private async calculatePricedItems(input: {
    tenantId: string;
    branchId: string;
    customerId: string;
    orderId: string;
    items: CreateOrderItemInput[];
    pricingCalculatedAt: Date;
  }) {
    const pricingDate = input.pricingCalculatedAt.toISOString();
    const items: OrderItemEntity[] = [];

    for (const item of input.items) {
      const quantity = item.orderedQuantity ?? item.quantity ?? 0;
      const preview = await this.pricingService.calculateLinePrice({
        tenantId: input.tenantId,
        branchId: input.branchId,
        customerId: input.customerId,
        productId: item.productId,
        quantity,
        channel: "ORDER",
        date: pricingDate,
      });

      items.push(
        OrderItemEntity.create({
          id: item.id ?? crypto.randomUUID(),
          orderId: input.orderId,
          productId: item.productId,
          orderedQuantity: preview.quantity,
          deliveredQuantity: item.deliveredQuantity ?? 0,
          price: preview.finalUnitPrice,
          subtotal: preview.lineTotal,
          baseUnitPrice: preview.baseUnitPrice,
          finalUnitPrice: preview.finalUnitPrice,
          discountAmount: preview.discountAmount,
          discountPercent: preview.discountPercent,
          discountTotal: this.roundCurrency(
            preview.discountAmount * preview.quantity
          ),
          appliedPromotionId: preview.appliedPromotionId,
          appliedPromotionName: preview.appliedPromotionName,
          taxId: preview.taxId,
          taxRate: preview.taxRate,
          taxBase: preview.taxBase,
          taxAmount: preview.taxAmount,
          lineTotal: preview.lineTotal,
          pricingSnapshot: this.buildPricingSnapshot({
            tenantId: input.tenantId,
            branchId: input.branchId,
            customerId: input.customerId,
            pricingCalculatedAt: input.pricingCalculatedAt,
            preview,
          }),
          pricingCalculatedAt: input.pricingCalculatedAt,
        })
      );
    }

    return items;
  }

  private calculateOrderTotal(items: OrderItemEntity[]) {
    return this.roundCurrency(
      items.reduce((sum, item) => sum + (item.lineTotal ?? item.subtotal), 0)
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

  private async ensureBranchBelongsToTenant(
    branchId: string,
    tenantId: string,
    client: PoolClient
  ) {
    const result = await client.query<BranchRow>(
      `
        SELECT id
        FROM tenant_branches
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [branchId, tenantId]
    );

    if (!result.rows[0]) {
      throw new BadRequestException("branch not found for tenant");
    }
  }

  private async getOrderAuditContext(
    orderId: string,
    tenantId: string,
    client?: PoolClient
  ) {
    const sql = `
        SELECT
          audit_context.branch_id::text AS branch_id,
          branch.nombre AS branch_name,
          audit_context.terminal_id::text AS terminal_id,
          terminal.name AS terminal_name
        FROM orders o
        LEFT JOIN LATERAL (
          SELECT
            NULLIF(ae.datos_despues->>'branchId', '')::uuid AS branch_id,
            NULLIF(ae.datos_despues->>'terminalId', '')::uuid AS terminal_id
          FROM auditoria_eventos ae
          WHERE ae.tenant_id = o.tenant_id
            AND ae.entidad = 'orders'
            AND ae.entidad_id = o.id::text
            AND ae.accion IN ('ORDER_CREATED', 'ORDER_UPDATED')
          ORDER BY ae.created_at DESC, ae.id DESC
          LIMIT 1
        ) AS audit_context ON TRUE
        LEFT JOIN tenant_branches branch
          ON branch.id = audit_context.branch_id
         AND branch.tenant_id = o.tenant_id
        LEFT JOIN terminals terminal
          ON terminal.id = audit_context.terminal_id
         AND terminal.tenant_id = o.tenant_id
        WHERE o.id = $1
          AND o.tenant_id = $2
        LIMIT 1
      `;
    const params = [orderId, tenantId];
    const result = client
      ? await client.query<OrderAuditContextRow>(sql, params)
      : await this.db.query<OrderAuditContextRow>(sql, params);

    return (
      result.rows[0] ?? {
        branch_id: null,
        branch_name: null,
        terminal_id: null,
        terminal_name: null,
      }
    );
  }

  private resolveStatusFromItems(items: OrderItemEntity[]): OrderStatus {
    if (items.length === 0) {
      return "CONFIRMED";
    }

    const allZero = items.every((item) => item.deliveredQuantity === 0);
    if (allZero) {
      return "CONFIRMED";
    }

    const allComplete = items.every(
      (item) => item.deliveredQuantity >= item.orderedQuantity
    );
    if (allComplete) {
      return "COMPLETED";
    }

    return "PARTIAL";
  }

  private resolveBillingStatus(items: OrderItemEntity[]) {
    const deliveredTotal = items.reduce((sum, item) => sum + item.deliveredQuantity, 0);
    const billedTotal = items.reduce((sum, item) => sum + item.billedQuantity, 0);

    if (deliveredTotal <= 0 || billedTotal <= 0) {
      return "UNBILLED" as const;
    }

    if (billedTotal >= deliveredTotal) {
      return "INVOICED" as const;
    }

    return "PARTIAL" as const;
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
            subtotal,
            base_unit_price,
            final_unit_price,
            discount_amount,
            discount_percent,
            discount_total,
            applied_promotion_id,
            applied_promotion_name,
            tax_id,
            tax_rate,
            tax_base,
            tax_amount,
            line_total,
            pricing_snapshot,
            pricing_calculated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20::jsonb, $21
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
          item.baseUnitPrice,
          item.finalUnitPrice,
          item.discountAmount,
          item.discountPercent,
          item.discountTotal,
          item.appliedPromotionId,
          item.appliedPromotionName,
          item.taxId,
          item.taxRate,
          item.taxBase,
          item.taxAmount,
          item.lineTotal,
          item.pricingSnapshot ? JSON.stringify(item.pricingSnapshot) : null,
          item.pricingCalculatedAt,
        ]
      );
    }
  }

  async createOrder(data: CreateOrderInput) {
    this.assertItems(data.items);
    const resolvedScope = await this.resolveOrderScope(data.actor, {
      tenantId: data.tenantId,
      branchId: data.branchId,
    });
    const orderBranchId = resolvedScope.branchId ?? data.context?.branchId ?? undefined;
    if (!orderBranchId) {
      throw new BadRequestException("branch is required");
    }

    const orderId = crypto.randomUUID();
    const createdAt = new Date();

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await this.ensureCustomerBelongsToTenant(data.customerId, data.tenantId, client);
      await this.ensureProductsBelongToTenant(data.items, data.tenantId, client);
      await this.ensureBranchBelongsToTenant(orderBranchId, data.tenantId, client);

      const items = await this.calculatePricedItems({
        tenantId: data.tenantId,
        branchId: orderBranchId,
        customerId: data.customerId,
        orderId,
        items: data.items,
        pricingCalculatedAt: createdAt,
      });
      const total = this.calculateOrderTotal(items);
      const order = OrderEntity.create({
        id: orderId,
        tenantId: data.tenantId,
        customerId: data.customerId,
        type: data.type ?? "CASH",
        status: "DRAFT",
        total,
        totalPaid: 0,
        balanceDue: total,
        paymentStatus: "PENDING",
        createdAt,
      });

      const orderResult = await client.query<OrderRow>(
        `
          INSERT INTO orders (
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            payment_status,
            total_paid,
            balance_due,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
          RETURNING
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            payment_status,
            total_paid,
            balance_due,
            created_at
        `,
        [
          order.id,
          order.tenantId,
          order.customerId,
          order.type,
          order.status,
          order.total,
          order.paymentStatus,
          order.totalPaid,
          order.balanceDue,
          order.createdAt,
        ]
      );

      await this.replaceItems(order.id, items, client);
      await client.query("COMMIT");

      this.auditService.logEvent({
        tenantId: order.tenantId,
        userId: data.context?.userId ?? null,
        module: "inventory",
        entity: "orders",
        entityId: order.id,
        action: "ORDER_CREATED",
        after: {
          customerId: order.customerId,
          type: order.type,
          total: order.total,
          branchId: orderBranchId,
          terminalId:
            data.context?.branchId === orderBranchId ? data.context?.terminalId ?? null : null,
          posSessionId:
            data.context?.branchId === orderBranchId ? data.context?.posSessionId ?? null : null,
        },
      });

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

  async updateOrder(
    id: string,
    tenantId: string,
    data: UpdateOrderInput,
    actor: BranchScopedActor
  ) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      await this.resolveOrderScope(actor, { tenantId });
      const currentAuditContext = await this.getOrderAuditContext(id, tenantId, client);

      const currentResult = await client.query<OrderRow>(
        `
          SELECT
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            payment_status,
            total_paid,
            balance_due,
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
      if (current.status !== "DRAFT") {
        throw new BadRequestException("only draft orders can be updated");
      }

      if (data.customerId) {
        await this.ensureCustomerBelongsToTenant(data.customerId, tenantId, client);
      }
      const nextBranchId = data.branchId ?? currentAuditContext.branch_id ?? undefined;
      if (!nextBranchId) {
        throw new BadRequestException("branch is required");
      }
      await this.ensureBranchBelongsToTenant(nextBranchId, tenantId, client);
      if (data.items) {
        this.assertItems(data.items);
        await this.ensureProductsBelongToTenant(data.items, tenantId, client);
      }

      const nextCustomerId = data.customerId ?? current.customer_id;
      const pricedItems = data.items
        ? await this.calculatePricedItems({
            tenantId,
            branchId: nextBranchId,
            customerId: nextCustomerId,
            orderId: id,
            items: data.items,
            pricingCalculatedAt: new Date(),
          })
        : null;

      const nextType = data.type ?? current.type;
      const nextTotal = pricedItems
        ? this.calculateOrderTotal(pricedItems)
        : data.total !== undefined
          ? data.total
          : Number(current.total);
      const nextTotalPaid = Number(current.total_paid ?? 0);
      const nextBalanceDue = Math.max(nextTotal - nextTotalPaid, 0);
      const nextPaymentStatus =
        nextTotalPaid <= 0
          ? "PENDING"
          : nextTotalPaid < nextTotal
            ? "PARTIAL"
            : nextTotalPaid === nextTotal
              ? "PAID"
              : "OVERPAID";

      const updateResult = await client.query<OrderRow>(
        `
          UPDATE orders
          SET
            customer_id = COALESCE($3, customer_id),
            type = COALESCE($4, type),
            status = COALESCE($5, status),
            total = COALESCE($6, total),
            total_paid = $7,
            balance_due = $8,
            payment_status = $9
          WHERE id = $1 AND tenant_id = $2
          RETURNING
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            payment_status,
            total_paid,
            balance_due,
            created_at
        `,
        [
          id,
          tenantId,
          data.customerId ?? null,
          nextType,
          data.status ?? null,
          nextTotal,
          nextTotalPaid,
          nextBalanceDue,
          nextPaymentStatus,
        ]
      );

      let items: OrderItemEntity[] = [];
      if (pricedItems) {
        items = pricedItems;
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
              COALESCE(billed_quantity, 0) AS billed_quantity,
              price,
              subtotal,
              base_unit_price,
              final_unit_price,
              discount_amount,
              discount_percent,
              discount_total,
              applied_promotion_id,
              applied_promotion_name,
              tax_id,
              tax_rate,
              tax_base,
              tax_amount,
              line_total,
              pricing_snapshot,
              pricing_calculated_at
            FROM order_items
            WHERE order_id = $1
            ORDER BY id
          `,
          [id]
        );
        items = itemsResult.rows.map((row) => this.mapOrderItem(row));
      }

      await client.query("COMMIT");

      this.auditService.logEvent({
        tenantId,
        userId: null,
        module: "inventory",
        entity: "orders",
        entityId: id,
        action: "ORDER_UPDATED",
        after: {
          customerId: updateResult.rows[0].customer_id,
          type: updateResult.rows[0].type,
          total: Number(updateResult.rows[0].total),
          branchId: nextBranchId,
          terminalId:
            currentAuditContext.branch_id === nextBranchId ? currentAuditContext.terminal_id : null,
        },
      });

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

  async getOrders(filters: BranchScopedFilters, actor: BranchScopedActor) {
    const resolvedFilters = await this.resolveOrderScope(actor, filters);
    const params: unknown[] = [];
    const where: string[] = [];
    const fromDate = normalizeOptionalFilter(filters.fromDate);
    const toDate = normalizeOptionalFilter(filters.toDate);
    const paymentMethod = normalizeOptionalFilter(filters.paymentMethod);

    if (resolvedFilters.tenantId) {
      params.push(resolvedFilters.tenantId);
      where.push(`o.tenant_id = $${params.length}`);
    }

    if (resolvedFilters.branchId) {
      params.push(resolvedFilters.branchId);
      where.push(`audit_context.branch_id = $${params.length}::uuid`);
    } else if ((resolvedFilters.branchIds?.length ?? 0) > 0) {
      params.push(resolvedFilters.branchIds);
      where.push(`audit_context.branch_id = ANY($${params.length}::uuid[])`);
    }

    if (fromDate) {
      params.push(fromDate);
      where.push(`o.created_at >= $${params.length}::date`);
    }

    if (toDate) {
      params.push(toDate);
      where.push(`o.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    if (paymentMethod) {
      params.push(paymentMethod);
      where.push(`
        (
          EXISTS (
            SELECT 1
            FROM payments AS pay
            WHERE pay.tenant_id = o.tenant_id
              AND pay.reference_type = 'SALES_ORDER'
              AND pay.reference_id = o.id
              AND pay.payment_method_id = $${params.length}::uuid
              AND pay.status IN ('PENDING', 'COMPLETED')
          )
          OR EXISTS (
            SELECT 1
            FROM payment_allocations AS allocation
            INNER JOIN payments AS pay
              ON pay.id = allocation.payment_id
            WHERE pay.tenant_id = o.tenant_id
              AND allocation.reference_type = 'SALES_ORDER'
              AND allocation.reference_id = o.id
              AND pay.payment_method_id = $${params.length}::uuid
              AND pay.status IN ('PENDING', 'COMPLETED')
          )
        )
      `);
    }

    const result = (await this.db.query(
      `
        SELECT
          o.id,
          o.tenant_id,
          t.nombre AS tenant_name,
          o.customer_id,
          o.type,
          o.status,
          o.total,
          o.payment_status,
          o.total_paid,
          o.balance_due,
          o.created_at,
          c.name AS customer_name,
          audit_context.branch_id::text AS branch_id,
          branch.nombre AS branch_name,
          terminal.name AS terminal_name,
          CASE
            WHEN COALESCE(item_totals.delivered_total, 0) <= 0
              OR COALESCE(item_totals.billed_total, 0) <= 0 THEN 'UNBILLED'
            WHEN COALESCE(item_totals.billed_total, 0) >= COALESCE(item_totals.delivered_total, 0)
              THEN 'INVOICED'
            ELSE 'PARTIAL'
          END AS billing_status
        FROM orders o
        INNER JOIN tenants t
          ON t.id = o.tenant_id
        LEFT JOIN customers c
          ON c.id = o.customer_id
         AND c.tenant_id = o.tenant_id
        LEFT JOIN LATERAL (
          SELECT
            NULLIF(ae.datos_despues->>'branchId', '')::uuid AS branch_id,
            NULLIF(ae.datos_despues->>'terminalId', '')::uuid AS terminal_id
          FROM auditoria_eventos ae
          WHERE ae.tenant_id = o.tenant_id
            AND ae.entidad = 'orders'
            AND ae.entidad_id = o.id::text
            AND ae.accion IN ('ORDER_CREATED', 'ORDER_UPDATED')
          ORDER BY ae.created_at DESC, ae.id DESC
          LIMIT 1
        ) AS audit_context ON TRUE
        LEFT JOIN tenant_branches branch
          ON branch.id = audit_context.branch_id
         AND branch.tenant_id = o.tenant_id
        LEFT JOIN terminals terminal
          ON terminal.id = audit_context.terminal_id
         AND terminal.tenant_id = o.tenant_id
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(oi.delivered_quantity), 0) AS delivered_total,
            COALESCE(SUM(COALESCE(oi.billed_quantity, 0)), 0) AS billed_total
          FROM order_items oi
          WHERE oi.order_id = o.id
        ) AS item_totals ON TRUE
        WHERE ${where.length > 0 ? where.join("\n          AND ") : "TRUE"}
        ORDER BY o.created_at DESC
      `,
      params
    )) as { rows: OrderListRow[] };

    return result.rows.map((row) => ({
      ...this.mapOrder(row),
      tenantName: row.tenant_name,
      customerName: row.customer_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      terminalName: row.terminal_name,
      billingStatus: row.billing_status,
    }));
  }

  async getOrderById(id: string, tenantId: string, actor: BranchScopedActor) {
    const orderAuditContext = await this.getOrderAuditContext(id, tenantId);
    await this.resolveOrderScope(actor, {
      tenantId,
      branchId: orderAuditContext.branch_id ?? undefined,
    });

    const orderResult = (await this.db.query(
      `
        SELECT
          id,
          tenant_id,
          customer_id,
          type,
          status,
          total,
          payment_status,
          total_paid,
          balance_due,
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

    const [itemsResult, paymentsResult] = await Promise.all([
      this.db.query(
      `
        SELECT
          oi.id,
          oi.order_id,
          oi.product_id,
          p.name AS product_name,
          oi.ordered_quantity,
          oi.delivered_quantity,
          COALESCE(oi.billed_quantity, 0) AS billed_quantity,
          oi.price,
          oi.subtotal,
          oi.base_unit_price,
          oi.final_unit_price,
          oi.discount_amount,
          oi.discount_percent,
          oi.discount_total,
          oi.applied_promotion_id,
          oi.applied_promotion_name,
          oi.tax_id,
          oi.tax_rate,
          oi.tax_base,
          oi.tax_amount,
          oi.line_total,
          oi.pricing_snapshot,
          oi.pricing_calculated_at
        FROM order_items oi
        INNER JOIN products p
          ON p.id = oi.product_id
         AND p.tenant_id = $2
        WHERE oi.order_id = $1
        ORDER BY p.name ASC, oi.id ASC
      `,
      [id, tenantId]
      ),
      this.db.query(
        `
          SELECT
            payment.id,
            payment.payment_method_id,
            method.nombre AS payment_method_nombre,
            method.tipo AS payment_method_tipo,
            payment.cash_session_id,
            payment.amount,
            payment.reference_number,
            payment.notes,
            COALESCE(order_allocated.total_allocated, 0) AS order_allocated_amount,
            COALESCE(invoiced.total_allocated, 0) AS invoiced_amount,
            COALESCE(order_allocated.total_allocated, 0) AS available_amount,
            payment.created_at
          FROM payments AS payment
          INNER JOIN payment_methods AS method
            ON method.id = payment.payment_method_id
           AND method.tenant_id = payment.tenant_id
          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(allocation.allocated_amount), 0) AS total_allocated
            FROM payment_allocations AS allocation
            WHERE allocation.payment_id = payment.id
              AND allocation.reference_type = 'SALES_ORDER'
              AND allocation.reference_id = $1
          ) AS order_allocated ON TRUE
          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(allocation.allocated_amount), 0) AS total_allocated
            FROM payment_allocations AS allocation
            WHERE allocation.payment_id = payment.id
              AND allocation.reference_type = 'SALE'
          ) AS invoiced ON TRUE
          WHERE payment.tenant_id = $2
            AND payment.reference_type = 'SALES_ORDER'
            AND payment.reference_id = $1
            AND payment.status IN ('PENDING', 'COMPLETED')
            AND COALESCE(order_allocated.total_allocated, 0) > 0
          ORDER BY payment.created_at ASC, payment.id ASC
        `,
        [id, tenantId]
      ),
    ]);

    return {
      ...this.mapOrderWithItems(orderRow, itemsResult.rows),
      branchId: orderAuditContext.branch_id,
      branchName: orderAuditContext.branch_name,
      terminalName: orderAuditContext.terminal_name,
      payments: (paymentsResult.rows as OrderPaymentRow[]).map((row) =>
        this.mapOrderPayment(row)
      ),
      billingStatus: this.resolveBillingStatus(
        itemsResult.rows.map((row) => this.mapOrderItem(row))
      ),
    };
  }

  async deliverOrder(
    id: string,
    tenantId: string,
    itemsToDeliver: Array<{ productId: string; quantity: number }>,
    context?: InventoryContext,
    actor?: BranchScopedActor
  ) {
    if (!Array.isArray(itemsToDeliver) || itemsToDeliver.length === 0) {
      throw new BadRequestException("deliver items are required");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const orderResult = await client.query<OrderRow>(
        `
          SELECT
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            payment_status,
            total_paid,
            balance_due,
            created_at
          FROM orders
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
        `,
        [id, tenantId]
      );

      const orderRow = orderResult.rows[0];
      if (!orderRow) {
        throw new NotFoundException("order not found");
      }
      if (orderRow.status === "CANCELLED") {
        throw new BadRequestException("cancelled orders cannot be delivered");
      }
      if (orderRow.status === "COMPLETED") {
        throw new BadRequestException("order already completed");
      }

      const orderAuditContext = await this.getOrderAuditContext(id, tenantId, client);
      await this.resolveOrderScope(
        actor ?? {
          roles: [],
          userId: context?.userId ?? undefined,
          tenantId,
          branchId: context?.branchId ?? undefined,
        },
        {
          tenantId,
          branchId: orderAuditContext.branch_id ?? undefined,
        }
      );

      const itemsResult = await client.query<OrderItemRow>(
        `
          SELECT
            id,
            order_id,
            product_id,
            ordered_quantity,
            delivered_quantity,
            COALESCE(billed_quantity, 0) AS billed_quantity,
            price,
            subtotal,
            base_unit_price,
            final_unit_price,
            discount_amount,
            discount_percent,
            discount_total,
            applied_promotion_id,
            applied_promotion_name,
            tax_id,
            tax_rate,
            tax_base,
            tax_amount,
            line_total,
            pricing_snapshot,
            pricing_calculated_at
          FROM order_items
          WHERE order_id = $1
          ORDER BY id
        `,
        [id]
      );

      const items = itemsResult.rows.map((row) => this.mapOrderItem(row));
      if (items.length === 0) {
        throw new BadRequestException("order items are required");
      }

      const itemsByProductId = new Map<string, OrderItemEntity[]>();
      for (const item of items) {
        const currentItems = itemsByProductId.get(item.productId) ?? [];
        currentItems.push(item);
        itemsByProductId.set(item.productId, currentItems);
      }

      const pendingByItemId = new Map(
        items.map((item) => [item.id, item.orderedQuantity - item.deliveredQuantity])
      );

      const createdMovements = [];

      for (const deliverItem of itemsToDeliver) {
        const productId = deliverItem.productId;
        if (!productId) {
          throw new BadRequestException("productId is required");
        }

        const quantity = Number(deliverItem.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new BadRequestException("delivered quantity must be a positive number");
        }

        const productItems = itemsByProductId.get(productId) ?? [];
        if (productItems.length === 0) {
          throw new BadRequestException("order item not found for product");
        }

        const totalPendingQuantity = productItems.reduce(
          (sum, item) => sum + (pendingByItemId.get(item.id) ?? 0),
          0
        );
        if (quantity > totalPendingQuantity) {
          throw new BadRequestException(
            "delivered quantity exceeds pending ordered quantity"
          );
        }

        const stockResult = await this.stockMovementService.getStockByProduct(
          productId,
          tenantId,
          orderAuditContext.branch_id ?? context?.branchId ?? null
        );
        if (stockResult.stock < quantity) {
          throw new BadRequestException("insufficient stock for delivery");
        }

        const movement = await this.stockMovementService.createMovement(
          {
            id: crypto.randomUUID(),
            tenantId,
            productId,
            type: "OUT",
            quantity,
            referenceType: "SALE",
            referenceId: id,
            branchId: orderAuditContext.branch_id ?? context?.branchId ?? null,
            terminalId:
              orderAuditContext.branch_id &&
              context?.branchId &&
              orderAuditContext.branch_id !== context.branchId
                ? null
                : context?.terminalId ?? null,
            posSessionCode:
              orderAuditContext.branch_id &&
              context?.branchId &&
              orderAuditContext.branch_id !== context.branchId
                ? null
                : context?.posSessionId ?? null,
            userId: context?.userId ?? null,
            referenceTable: "orders",
            createdAt: new Date(),
          },
          client
        );
        createdMovements.push(movement);

        let remainingQuantity = quantity;
        for (const item of productItems) {
          if (remainingQuantity <= 0) {
            break;
          }

          const itemPendingQuantity = pendingByItemId.get(item.id) ?? 0;
          if (itemPendingQuantity <= 0) {
            continue;
          }

          const deliveredDelta = Math.min(remainingQuantity, itemPendingQuantity);
          pendingByItemId.set(item.id, itemPendingQuantity - deliveredDelta);
          remainingQuantity -= deliveredDelta;

          await client.query(
            `
              UPDATE order_items
              SET delivered_quantity = delivered_quantity + $2
              WHERE id = $1
            `,
            [item.id, deliveredDelta]
          );
        }
      }

      const updatedItemsResult = await client.query<OrderItemRow>(
        `
          SELECT
            id,
            order_id,
            product_id,
            ordered_quantity,
            delivered_quantity,
            COALESCE(billed_quantity, 0) AS billed_quantity,
            price,
            subtotal,
            base_unit_price,
            final_unit_price,
            discount_amount,
            discount_percent,
            discount_total,
            applied_promotion_id,
            applied_promotion_name,
            tax_id,
            tax_rate,
            tax_base,
            tax_amount,
            line_total,
            pricing_snapshot,
            pricing_calculated_at
          FROM order_items
          WHERE order_id = $1
          ORDER BY id
        `,
        [id]
      );

      const updatedItems = updatedItemsResult.rows.map((row) => this.mapOrderItem(row));
      const nextStatus = this.resolveStatusFromItems(updatedItems);

      const updatedOrderResult = await client.query<OrderRow>(
        `
          UPDATE orders
          SET status = $3
          WHERE id = $1 AND tenant_id = $2
          RETURNING
            id,
            tenant_id,
            customer_id,
            type,
            status,
            total,
            payment_status,
            total_paid,
            balance_due,
            created_at
        `,
        [id, tenantId, nextStatus]
      );

      await client.query("COMMIT");
      createdMovements.forEach((movement) =>
        this.stockMovementService.logMovementAuditEvent(movement)
      );

      return {
        ...this.mapOrder(updatedOrderResult.rows[0]),
        items: updatedItems,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async confirmOrder(
    id: string,
    tenantId: string,
    context?: InventoryContext,
    actor?: BranchScopedActor
  ) {
    const order = await this.getOrderById(
      id,
      tenantId,
      actor ?? {
        roles: [],
        userId: context?.userId ?? undefined,
        tenantId,
        branchId: context?.branchId ?? undefined,
      }
    );

    if (order.status !== "DRAFT") {
      throw new BadRequestException("only draft orders can be confirmed");
    }

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
          payment_status,
          total_paid,
          balance_due,
          created_at
      `,
      [id, tenantId]
    )) as { rows: OrderRow[] };

    if (!result.rows[0]) {
      throw new BadRequestException("order could not be confirmed");
    }

    return {
      ...this.mapOrder(result.rows[0]),
      items: order.items,
      branchId: order.branchId,
      branchName: order.branchName,
      terminalName: order.terminalName,
      billingStatus: order.billingStatus,
    };
  }

  async invoiceOrder(
    id: string,
    tenantId: string,
    data: {
      type: "CASH" | "CREDIT";
      payments?: Array<{
        paymentMethodId: string;
        amount: number;
        cashSessionId?: string | null;
        referenceNumber?: string | null;
        notes?: string | null;
      }>;
    },
    context?: InventoryContext,
    actor?: BranchScopedActor
  ) {
    const order = await this.getOrderById(
      id,
      tenantId,
      actor ?? {
        roles: [],
        userId: context?.userId ?? undefined,
        tenantId,
        branchId: context?.branchId ?? undefined,
      }
    );

    if (order.status !== "PARTIAL" && order.status !== "COMPLETED") {
      throw new BadRequestException("only partial or completed orders can be invoiced");
    }

    const invoiceableQuantity = order.items.reduce(
      (sum, item) => sum + Math.max(item.deliveredQuantity - item.billedQuantity, 0),
      0
    );
    if (invoiceableQuantity <= 0) {
      throw new BadRequestException("order has no delivered items pending invoicing");
    }

    return this.saleService.createSaleFromOrderDelivery(
      {
        orderId: id,
        type: data.type,
        payments: data.payments ?? [],
      },
      {
        tenantId,
        userId: context?.userId ?? undefined,
        branchId: context?.branchId ?? undefined,
        terminalId: context?.terminalId ?? undefined,
        posSessionId: context?.posSessionId ?? undefined,
      }
    );
  }

  async cancelOrder(id: string, tenantId: string, actor: BranchScopedActor) {
    const order = await this.getOrderById(id, tenantId, actor);
    if (order.status !== "DRAFT") {
      throw new BadRequestException("only draft orders can be cancelled");
    }
    const result = (await this.db.query(
      `
        UPDATE orders
        SET status = 'CANCELLED'
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
          payment_status,
          total_paid,
          balance_due,
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
            payment_status,
            total_paid,
            balance_due,
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
      throw new BadRequestException("only draft orders can be cancelled");
    }

    return this.mapOrder(result.rows[0]);
  }
}
