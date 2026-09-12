import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import type { SaleType } from "../entities/sale.entity";

export type SaleRow = {
  id: string;
  tenant_id: string;
  branch_id?: string;
  terminal_id?: string;
  user_id?: string;
  pos_session_id?: string;
  customer_id: string;
  order_id: string | null;
  type: SaleType;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED" | "REFUNDED";
  total: string | number;
  balance: string | number;
  payment_status: "PENDING" | "PARTIAL" | "PAID" | "OVERPAID";
  total_paid: string | number;
  balance_due: string | number;
  created_at: string | Date;
};

export type SaleCreateContext = {
  tenantId: string;
  branchId: string;
  terminalId: string;
  userId: string;
  posSessionId: string;
};

export type CreateSaleItemInput = {
  productId: string;
  quantity: number;
  price: number;
  orderItemId?: string | null;
  subtotal?: number;
  priceWithoutTax?: number;
  taxTotal?: number;
  baseUnitPrice?: number;
  finalUnitPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  discountTotal?: number;
  appliedPromotionId?: string | null;
  appliedPromotionName?: string | null;
  taxId?: string | null;
  taxRate?: number;
  taxBase?: number;
  taxAmount?: number;
  lineTotal?: number;
  pricingSnapshot?: Record<string, unknown> | null;
  pricingCalculatedAt?: Date | string | null;
  pricingSource?: string | null;
  taxes?: Array<{
    taxId: string;
    taxName: string;
    dianCode?: string | null;
    taxTypeCode?: string | null;
    calculationMethodCode?: string | null;
    taxRate: number;
    taxBase: number;
    taxAmount: number;
    isIncluded: boolean;
  }>;
};

export type CreateSalePaymentInput = {
  paymentMethodId: string;
  amount: number;
  cashSessionId?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
};

export type CreateSaleInput = SaleCreateContext & {
  customerId: string;
  orderId?: string | null;
  type: SaleType;
  items: CreateSaleItemInput[];
  payments?: CreateSalePaymentInput[];
};

type ProductForSaleRow = {
  id: string;
  tax_id: string | null;
  tax_name: string | null;
  tax_rate: string | number | null;
  tax_is_included: boolean | null;
  is_active: boolean;
};

type OrderItemRow = {
  id: string;
  product_id: string;
  ordered_quantity: string | number;
  delivered_quantity: string | number;
  billed_quantity: string | number;
  price: string | number;
  subtotal: string | number;
};

type PosSessionValidationRow = {
  id: string;
};

type CurrentPosContextRow = {
  pos_session_id: string;
  branch_id: string;
  terminal_id: string;
};

type InventoryCreateSaleFunctionRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  order_id: string | null;
  type: SaleType;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED" | "REFUNDED";
  total: string | number;
  balance: string | number;
  created_at: string | Date;
};

type PaymentMethodLookupRow = {
  id: string;
  tipo: string;
};

const CREATE_SALE_FUNCTION_NAMES = {
  legacy: "inventory_create_sale",
  primary: "inventory_create_sale_v2",
} as const;

type CreateSaleFunctionName =
  (typeof CREATE_SALE_FUNCTION_NAMES)[keyof typeof CREATE_SALE_FUNCTION_NAMES];

@Injectable()
export class SaleRepository {
  private readonly logger = new Logger(SaleRepository.name);

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  private resolveCreateSaleFunctionName(): CreateSaleFunctionName {
    return CREATE_SALE_FUNCTION_NAMES.primary;
  }

  private serializeTimestamp(value: Date | string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    return value instanceof Date ? value.toISOString() : value;
  }

  private serializeCreateSaleItem(item: CreateSaleItemInput) {
    const serializedItem: Record<string, unknown> = {
      product_id: item.productId,
      quantity: item.quantity,
      price: item.price,
      order_item_id: item.orderItemId ?? null,
    };

    if (item.subtotal !== undefined) serializedItem.subtotal = item.subtotal;
    if (item.priceWithoutTax !== undefined) {
      serializedItem.price_without_tax = item.priceWithoutTax;
    }
    if (item.taxTotal !== undefined) serializedItem.tax_total = item.taxTotal;
    if (item.baseUnitPrice !== undefined) {
      serializedItem.base_unit_price = item.baseUnitPrice;
    }
    if (item.finalUnitPrice !== undefined) {
      serializedItem.final_unit_price = item.finalUnitPrice;
    }
    if (item.discountAmount !== undefined) {
      serializedItem.discount_amount = item.discountAmount;
    }
    if (item.discountPercent !== undefined) {
      serializedItem.discount_percent = item.discountPercent;
    }
    if (item.discountTotal !== undefined) {
      serializedItem.discount_total = item.discountTotal;
    }
    if (item.appliedPromotionId !== undefined) {
      serializedItem.applied_promotion_id = item.appliedPromotionId;
    }
    if (item.appliedPromotionName !== undefined) {
      serializedItem.applied_promotion_name = item.appliedPromotionName;
    }
    if (item.taxId !== undefined) serializedItem.tax_id = item.taxId;
    if (item.taxRate !== undefined) serializedItem.tax_rate = item.taxRate;
    if (item.taxBase !== undefined) serializedItem.tax_base = item.taxBase;
    if (item.taxAmount !== undefined) serializedItem.tax_amount = item.taxAmount;
    if (item.lineTotal !== undefined) serializedItem.line_total = item.lineTotal;
    if (item.pricingSnapshot !== undefined) {
      serializedItem.pricing_snapshot = item.pricingSnapshot;
    }
    if (item.pricingCalculatedAt !== undefined) {
      serializedItem.pricing_calculated_at = this.serializeTimestamp(
        item.pricingCalculatedAt
      );
    }
    if (item.pricingSource !== undefined) {
      serializedItem.pricing_source = item.pricingSource;
    }
    if (item.taxes !== undefined) {
      serializedItem.taxes = item.taxes.map((tax) => ({
        tax_id: tax.taxId,
        tax_name: tax.taxName,
        tax_rate: tax.taxRate,
        tax_base: tax.taxBase,
        tax_amount: tax.taxAmount,
        is_included: tax.isIncluded,
        dian_code: tax.dianCode ?? null,
        tax_type_code: tax.taxTypeCode ?? null,
        calculation_method_code: tax.calculationMethodCode ?? null,
      }));
    }

    return serializedItem;
  }

  private async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient
  ) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query(text, params);
  }

  async validateActivePosSession(
    context: SaleCreateContext,
    client: PoolClient
  ): Promise<boolean> {
    const result = await this.query<PosSessionValidationRow>(
      `SELECT id
      FROM pos_user_sessions
      WHERE id = $1
        AND tenant_id = $2
        AND branch_id = $3
        AND terminal_id = $4
        AND user_id = $5
        AND is_active = TRUE
      LIMIT 1`,
      [
        context.posSessionId,
        context.tenantId,
        context.branchId,
        context.terminalId,
        context.userId,
      ],
      client
    );
    return Boolean(result.rows[0]);
  }

  async findCurrentPosContext(
    tenantId: string,
    userId: string,
    authSessionId?: string,
    client?: PoolClient
  ): Promise<CurrentPosContextRow | null> {
    const params: unknown[] = [tenantId, userId];
    let authSessionFilter = "";

    if (authSessionId) {
      params.push(authSessionId);
      authSessionFilter = `AND auth_session_id = $${params.length}`;
    }

    const result = await this.query<CurrentPosContextRow>(
      `SELECT
        id AS pos_session_id,
        branch_id,
        terminal_id
      FROM pos_user_sessions
      WHERE tenant_id = $1
        AND user_id = $2
        AND is_active = TRUE
        ${authSessionFilter}
      ORDER BY started_at DESC
      LIMIT 1`,
      params,
      client
    );
    return result.rows[0] ?? null;
  }

  async validateCustomer(
    tenantId: string,
    customerId: string,
    client: PoolClient
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM customers
      WHERE id = $1
        AND tenant_id = $2
        AND is_active = TRUE
      LIMIT 1`,
      [customerId, tenantId],
      client
    );
    return Boolean(result.rows[0]);
  }

  async validateOrder(
    tenantId: string,
    orderId: string,
    client: PoolClient
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM orders
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1`,
      [orderId, tenantId],
      client
    );
    return Boolean(result.rows[0]);
  }

  async getProductForSale(
    tenantId: string,
    productId: string,
    client: PoolClient
  ): Promise<ProductForSaleRow | null> {
    const result = await this.query<ProductForSaleRow>(
      `SELECT
        p.id,
        p.tax_id,
        t.name AS tax_name,
        COALESCE(t.rate, 0) AS tax_rate,
        COALESCE(t.is_included, FALSE) AS tax_is_included,
        p.is_active
      FROM products p
      LEFT JOIN taxes t
        ON t.id = p.tax_id
       AND t.tenant_id = p.tenant_id
      WHERE p.id = $1
        AND p.tenant_id = $2
        AND p.is_active = TRUE
      LIMIT 1`,
      [productId, tenantId],
      client
    );
    return result.rows[0] ?? null;
  }

  async getOrderItemForUpdate(
    tenantId: string,
    orderId: string,
    orderItemId: string,
    client: PoolClient
  ): Promise<OrderItemRow | null> {
    const result = await this.query<OrderItemRow>(
      `SELECT
        oi.id,
        oi.product_id,
        oi.ordered_quantity,
        oi.delivered_quantity,
        COALESCE(oi.billed_quantity, 0) AS billed_quantity,
        oi.price,
        oi.subtotal
      FROM order_items oi
      INNER JOIN orders o
        ON o.id = oi.order_id
      WHERE oi.id = $1
        AND oi.order_id = $2
        AND o.tenant_id = $3
      FOR UPDATE OF oi`,
      [orderItemId, orderId, tenantId],
      client
    );
    return result.rows[0] ?? null;
  }

  async getAvailableStock(
    tenantId: string,
    branchId: string,
    productId: string,
    client: PoolClient
  ): Promise<number> {
    const result = await this.query<{ available_stock: string | number }>(
      `SELECT
        COALESCE(SUM(quantity) FILTER (WHERE type = 'IN'), 0)
        - COALESCE(SUM(quantity) FILTER (WHERE type = 'OUT'), 0) AS available_stock
      FROM stock_movements
      WHERE tenant_id = $1
        AND branch_id = $2
        AND product_id = $3`,
      [tenantId, branchId, productId],
      client
    );
    const value = result.rows[0]?.available_stock ?? 0;
    return typeof value === "number" ? value : Number(value);
  }

  async createSale(
    data: CreateSaleInput,
    client: PoolClient
  ): Promise<SaleRow | null> {
    const result = await this.query<SaleRow>(
      `INSERT INTO sales (
        id,
        tenant_id,
        branch_id,
        terminal_id,
        user_id,
        pos_session_id,
        customer_id,
        order_id,
        type,
        status,
        total,
        balance,
        payment_status,
        total_paid,
        balance_due,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        'DRAFT',
        0,
        0,
        'PENDING',
        0,
        0,
        NOW()
      )
      RETURNING
        id,
        tenant_id,
        branch_id,
        terminal_id,
        user_id,
        pos_session_id,
        customer_id,
        order_id,
        type,
        status,
        total,
        balance,
        payment_status,
        total_paid,
        balance_due,
        created_at`,
      [
        data.tenantId,
        data.branchId,
        data.terminalId,
        data.userId,
        data.posSessionId,
        data.customerId,
        data.orderId ?? null,
        data.type,
      ],
      client
    );
    return result.rows[0] ?? null;
  }

  async createSaleWithFunction(
    data: CreateSaleInput,
    paymentMethods: Array<{
      paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
      amount: number;
      reference?: string | null;
    }>,
    client: PoolClient
  ): Promise<InventoryCreateSaleFunctionRow | null> {
    const functionItems = (data.items ?? []).map((item) =>
      this.serializeCreateSaleItem(item)
    );
    const functionPaymentMethods = (paymentMethods ?? []).map((payment) => ({
      payment_method: payment.paymentMethod,
      amount: payment.amount,
      reference: payment.reference ?? null,
    }));
    const createSaleFunctionName = this.resolveCreateSaleFunctionName();

    this.logger.debug(`Using ${createSaleFunctionName} for POS sale creation`);

    const result = await this.query<InventoryCreateSaleFunctionRow>(
      `SELECT
        id,
        tenant_id,
        customer_id,
        order_id,
        type,
        status,
        total,
        balance,
        created_at
      FROM ${createSaleFunctionName}(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5::uuid,
        $6::uuid,
        $7::uuid,
        $8::varchar(20),
        $9::jsonb,
        $10::jsonb
      )`,
      [
        data.tenantId,
        data.branchId,
        data.terminalId,
        data.userId,
        data.posSessionId,
        data.customerId,
        data.orderId ?? null,
        data.type,
        JSON.stringify(functionItems),
        JSON.stringify(functionPaymentMethods),
      ],
      client
    );

    return result.rows[0] ?? null;
  }

  async invoiceOrderWithFunction(
    data: SaleCreateContext & {
      orderId: string;
      type: SaleType;
      payments?: CreateSalePaymentInput[];
    },
    client: PoolClient
  ): Promise<InventoryCreateSaleFunctionRow | null> {
    const functionPayments = (data.payments ?? []).map((payment) => ({
      payment_method_id: payment.paymentMethodId,
      amount: payment.amount,
      cash_session_id: payment.cashSessionId ?? null,
      reference_number: payment.referenceNumber ?? null,
      notes: payment.notes ?? null,
    }));

    const result = await this.query<InventoryCreateSaleFunctionRow>(
      `SELECT
        id,
        tenant_id,
        customer_id,
        order_id,
        type,
        status,
        total,
        balance,
        created_at
      FROM inventory_invoice_order(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5::uuid,
        $6::uuid,
        $7::varchar(20),
        $8::jsonb
      )`,
      [
        data.tenantId,
        data.branchId,
        data.terminalId,
        data.userId,
        data.posSessionId,
        data.orderId,
        data.type,
        JSON.stringify(functionPayments),
      ],
      client
    );

    return result.rows[0] ?? null;
  }

  async findPaymentMethodTypesByIds(
    tenantId: string,
    paymentMethodIds: string[],
    client: PoolClient
  ) {
    if (paymentMethodIds.length === 0) {
      return new Map<string, "CASH" | "CARD" | "TRANSFER" | "OTHER">();
    }

    const result = await this.query<PaymentMethodLookupRow>(
      `SELECT id, tipo
       FROM payment_methods
       WHERE tenant_id = $1
         AND id = ANY($2::uuid[])`,
      [tenantId, paymentMethodIds],
      client
    );

    return new Map(
      result.rows.map((row) => {
        const paymentMethod =
          row.tipo === "BANK"
            ? "TRANSFER"
            : row.tipo === "CASH" || row.tipo === "CARD"
              ? row.tipo
              : "OTHER";
        return [row.id, paymentMethod as "CASH" | "CARD" | "TRANSFER" | "OTHER"];
      })
    );
  }

  async insertSaleItem(
    saleId: string,
    tenantId: string,
    item: {
      productId: string;
      orderItemId?: string | null;
      quantity: number;
      price: number;
      priceWithoutTax: number;
      taxTotal: number;
      subtotal: number;
    },
    client: PoolClient
  ): Promise<string> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO sale_items (
        id,
        tenant_id,
        sale_id,
        product_id,
        order_item_id,
        quantity,
        price,
        price_without_tax,
        tax_total,
        subtotal,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        NOW()
      )
      RETURNING id`,
      [
        tenantId,
        saleId,
        item.productId,
        item.orderItemId ?? null,
        item.quantity,
        item.price,
        item.priceWithoutTax,
        item.taxTotal,
        item.subtotal,
      ],
      client
    );
    return result.rows[0].id;
  }

  async insertSaleItemTax(
    tenantId: string,
    saleItemId: string,
    tax: {
      taxId: string;
      taxName: string;
      taxRate: number;
      taxAmount: number;
      isIncluded: boolean;
    },
    client: PoolClient
  ) {
    await this.query(
      `INSERT INTO sale_item_taxes (
        id,
        tenant_id,
        sale_item_id,
        tax_id,
        tax_name,
        tax_rate,
        tax_amount,
        is_included,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        NOW()
      )`,
      [
        tenantId,
        saleItemId,
        tax.taxId,
        tax.taxName,
        tax.taxRate,
        tax.taxAmount,
        tax.isIncluded,
      ],
      client
    );
  }

  async insertStockMovement(
    tenantId: string,
    productId: string,
    quantity: number,
    saleId: string,
    client: PoolClient
  ) {
    await this.query(
      `INSERT INTO stock_movements (
        id,
        tenant_id,
        product_id,
        type,
        quantity,
        reference_type,
        reference_id,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        'OUT',
        $3,
        'SALE',
        $4,
        NOW()
      )`,
      [tenantId, productId, quantity, saleId],
      client
    );
  }

  async updateOrderItemDeliveredQuantity(
    orderItemId: string,
    quantity: number,
    client: PoolClient
  ) {
    await this.query(
      `UPDATE order_items
      SET delivered_quantity = delivered_quantity + $2
      WHERE id = $1`,
      [orderItemId, quantity],
      client
    );
  }

  async updateOrderItemBilledQuantity(
    orderItemId: string,
    quantity: number,
    client: PoolClient
  ) {
    await this.query(
      `UPDATE order_items
      SET billed_quantity = COALESCE(billed_quantity, 0) + $2
      WHERE id = $1`,
      [orderItemId, quantity],
      client
    );
  }

  async initializeSaleFinancials(
    saleId: string,
    tenantId: string,
    total: number,
    client: PoolClient
  ) {
    await this.query(
      `UPDATE sales
      SET total = $3::numeric,
          balance = CASE
            WHEN type = 'CASH' THEN 0::numeric
            ELSE $3::numeric
          END,
          total_paid = 0::numeric,
          balance_due = CASE
            WHEN type = 'CASH' THEN 0::numeric
            ELSE $3::numeric
          END,
          payment_status = 'PENDING'
      WHERE id = $1
        AND tenant_id = $2`,
      [saleId, tenantId, total],
      client
    );
  }

  async insertSalePaymentMethod(
    tenantId: string,
    saleId: string,
    payment: {
      paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
      amount: number;
      reference?: string | null;
    },
    client: PoolClient
  ) {
    await this.query(
      `INSERT INTO sale_payment_methods (
        id,
        tenant_id,
        sale_id,
        payment_method,
        amount,
        reference,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        NOW()
      )`,
      [
        tenantId,
        saleId,
        payment.paymentMethod,
        payment.amount,
        payment.reference ?? null,
      ],
      client
    );
  }

  async updateSaleStatus(
    saleId: string,
    tenantId: string,
    status: SaleRow["status"],
    client: PoolClient
  ) {
    await this.query(
      `UPDATE sales
       SET status = $3
       WHERE id = $1
         AND tenant_id = $2`,
      [saleId, tenantId, status],
      client
    );
  }

  async refreshOrderStatus(
    orderId: string,
    tenantId: string,
    client: PoolClient
  ) {
    await this.query(
      `UPDATE orders
      SET status = (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 'CONFIRMED'
          WHEN COUNT(*) FILTER (WHERE delivered_quantity = 0) = COUNT(*) THEN 'CONFIRMED'
          WHEN COUNT(*) FILTER (WHERE delivered_quantity >= ordered_quantity) = COUNT(*) THEN 'COMPLETED'
          ELSE 'PARTIAL'
        END
        FROM order_items
        WHERE order_id = $1
      )
      WHERE id = $1
        AND tenant_id = $2`,
      [orderId, tenantId],
      client
    );
  }
}
