import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { DatabaseService } from "../../../common/db/database.service";
import { AuditService } from "../../../common/services/audit.service";
import { SaleEntity } from "../entities/sale.entity";
import { SaleItemEntity } from "../entities/sale-item.entity";
import {
  SaleItemTaxEntity,
} from "../entities/sale-item-tax.entity";
import {
  SalePaymentMethodEntity,
  type SalePaymentMethodType,
} from "../entities/sale-payment-method.entity";
import {
  SaleRepository,
  type CreateSaleInput,
  type SaleRow,
} from "../repositories/sale.repository";

type SaleListRow = SaleRow & {
  customer_name: string | null;
};

type SaleDetailRow = SaleRow & {
  customer_name: string | null;
};

type SaleItemRow = {
  id: string;
  tenant_id: string;
  sale_id: string;
  product_id: string;
  order_item_id: string | null;
  quantity: string | number;
  price: string | number;
  price_without_tax: string | number;
  tax_total: string | number;
  subtotal: string | number;
  created_at: Date;
};

type SaleItemTaxRow = {
  id: string;
  tenant_id: string;
  sale_item_id: string;
  tax_id: string;
  tax_name: string;
  tax_rate: string | number;
  tax_amount: string | number;
  is_included: boolean;
  created_at: Date;
};

type SalePaymentMethodRow = {
  id: string;
  tenant_id: string;
  sale_id: string;
  payment_method: SalePaymentMethodType;
  amount: string | number;
  reference: string | null;
  created_at: Date;
};

type SaleContext = {
  userId?: string;
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  posSessionId?: string;
  sessionId?: string;
};

@Injectable()
export class SaleService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(SaleRepository) private readonly repository: SaleRepository,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  private toNumber(value: string | number) {
    return typeof value === "number" ? value : Number(value);
  }

  private mapSale(row: SaleRow) {
    return SaleEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      orderId: row.order_id,
      type: row.type,
      status: row.status,
      total: this.toNumber(row.total),
      balance: this.toNumber(row.balance),
      createdAt: new Date(row.created_at),
    });
  }

  private mapSaleSummary(row: SaleListRow | SaleDetailRow) {
    return {
      ...this.mapSale(row),
      customer: {
        id: row.customer_id,
        name: row.customer_name ?? null,
      },
      customerName: row.customer_name ?? null,
    };
  }

  private mapSaleItem(row: SaleItemRow) {
    return SaleItemEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      saleId: row.sale_id,
      productId: row.product_id,
      orderItemId: row.order_item_id,
      quantity: this.toNumber(row.quantity),
      price: this.toNumber(row.price),
      priceWithoutTax: this.toNumber(row.price_without_tax),
      taxTotal: this.toNumber(row.tax_total),
      subtotal: this.toNumber(row.subtotal),
      createdAt: new Date(row.created_at),
    });
  }

  private mapSaleItemTax(row: SaleItemTaxRow) {
    return SaleItemTaxEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      saleItemId: row.sale_item_id,
      taxId: row.tax_id,
      taxName: row.tax_name,
      taxRate: this.toNumber(row.tax_rate),
      taxAmount: this.toNumber(row.tax_amount),
      isIncluded: row.is_included,
      createdAt: new Date(row.created_at),
    });
  }

  private mapSalePaymentMethod(row: SalePaymentMethodRow) {
    return SalePaymentMethodEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      saleId: row.sale_id,
      paymentMethod: row.payment_method,
      amount: this.toNumber(row.amount),
      reference: row.reference,
      createdAt: new Date(row.created_at),
    });
  }

  private async normalizeSaleContext(context?: SaleContext) {
    if (!context?.tenantId || !context.userId) {
      throw new UnauthorizedException("Incomplete POS context");
    }

    if (context.posSessionId && context.branchId && context.terminalId) {
      return {
        tenantId: context.tenantId,
        userId: context.userId,
        branchId: context.branchId,
        terminalId: context.terminalId,
        posSessionId: context.posSessionId,
      };
    }

    const currentPosContext = await this.repository.findCurrentPosContext(
      context.tenantId,
      context.userId,
      context.sessionId
    );
    if (!currentPosContext) {
      throw new UnauthorizedException("POS session is required");
    }

    return {
      tenantId: context.tenantId,
      userId: context.userId,
      branchId: currentPosContext.branch_id,
      terminalId: currentPosContext.terminal_id,
      posSessionId: currentPosContext.pos_session_id,
    };
  }

  private ensureSaleInput(data: Omit<CreateSaleInput, "tenantId" | "branchId" | "terminalId" | "userId" | "posSessionId">) {
    if (!data.customerId) {
      throw new BadRequestException("customerId is required");
    }
    if (!data.items?.length) {
      throw new BadRequestException("sale items are required");
    }
    if (!["CASH", "CREDIT"].includes(data.type)) {
      throw new BadRequestException("type is invalid");
    }
  }

  async createSale(
    data: Omit<CreateSaleInput, "tenantId" | "branchId" | "terminalId" | "userId" | "posSessionId">,
    context: SaleContext
  ) {
    const saleContext = await this.normalizeSaleContext(context);
    this.ensureSaleInput(data);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const validPosSession = await this.repository.validateActivePosSession(
        saleContext,
        client
      );
      if (!validPosSession) {
        throw new UnauthorizedException("POS session is invalid");
      }
      const saleRow = await this.repository.createSale(
        {
          ...data,
          ...saleContext,
        },
        client
      );
      if (!saleRow) {
        throw new BadRequestException("sale could not be created");
      }

      await client.query("COMMIT");
      this.auditService.logEvent({
        tenantId: saleContext.tenantId,
        userId: saleContext.userId,
        module: "sales",
        entity: "sales",
        entityId: saleRow.id,
        action: "SALE_CREATED",
      });

      const saleResult = { rows: [saleRow] };
      const saleRowResult = saleResult.rows[0] as SaleRow | undefined;
      if (!saleRowResult) {
        throw new BadRequestException("sale could not be created");
      }

      const [itemsResult, itemTaxesResult, paymentMethodsResult] = await Promise.all([
      this.db.query(
        `
          SELECT
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
          FROM sale_items
          WHERE sale_id = $1
            AND tenant_id = $2
          ORDER BY created_at ASC, id ASC
        `,
        [saleRow.id, saleRow.tenant_id]
      ),
      this.db.query(
        `
          SELECT
            id,
            tenant_id,
            sale_item_id,
            tax_id,
            tax_name,
            tax_rate,
            tax_amount,
            is_included,
            created_at
          FROM sale_item_taxes
          WHERE sale_item_id IN (
            SELECT id
            FROM sale_items
            WHERE sale_id = $1
              AND tenant_id = $2
          )
            AND tenant_id = $2
          ORDER BY created_at ASC, id ASC
        `,
        [saleRow.id, saleRow.tenant_id]
      ),
      this.db.query(
        `
          SELECT
            id,
            tenant_id,
            sale_id,
            payment_method,
            amount,
            reference,
            created_at
          FROM sale_payment_methods
          WHERE sale_id = $1
            AND tenant_id = $2
          ORDER BY created_at ASC, id ASC
        `,
        [saleRow.id, saleRow.tenant_id]
      ),
    ]);

      return {
        ...this.mapSale(saleRowResult),
        items: (itemsResult.rows as SaleItemRow[]).map((row) => this.mapSaleItem(row)),
        itemTaxes: (itemTaxesResult.rows as SaleItemTaxRow[]).map((row) =>
          this.mapSaleItemTax(row)
        ),
        paymentMethods: (paymentMethodsResult.rows as SalePaymentMethodRow[]).map((row) =>
          this.mapSalePaymentMethod(row)
        ),
        payment_methods: (paymentMethodsResult.rows as SalePaymentMethodRow[]).map((row) =>
          this.mapSalePaymentMethod(row)
        ),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSales(tenantId: string) {
    const result = (await this.db.query(
      `
        SELECT
          s.id,
          s.tenant_id,
          s.customer_id,
          s.order_id,
          s.type,
          s.status,
          s.total,
          s.balance,
          s.created_at,
          c.name AS customer_name
        FROM sales s
        LEFT JOIN customers c
          ON c.id = s.customer_id
         AND c.tenant_id = s.tenant_id
        WHERE s.tenant_id = $1
        ORDER BY s.created_at DESC, s.id DESC
      `,
      [tenantId]
    )) as { rows: SaleListRow[] };

    return result.rows.map((row) => this.mapSaleSummary(row));
  }

  async getSaleById(id: string, tenantId: string) {
    const saleResult = (await this.db.query(
      `
        SELECT
          s.id,
          s.tenant_id,
          s.customer_id,
          s.order_id,
          s.type,
          s.status,
          s.total,
          s.balance,
          s.created_at,
          c.name AS customer_name
        FROM sales s
        LEFT JOIN customers c
          ON c.id = s.customer_id
         AND c.tenant_id = s.tenant_id
        WHERE s.id = $1
          AND s.tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId]
    )) as { rows: SaleDetailRow[] };

    const saleRow = saleResult.rows[0];
    if (!saleRow) {
      throw new NotFoundException("sale not found");
    }

    const [itemsResult, itemTaxesResult, paymentMethodsResult] = await Promise.all([
      this.db.query(
        `
          SELECT
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
          FROM sale_items
          WHERE sale_id = $1
            AND tenant_id = $2
          ORDER BY created_at ASC, id ASC
        `,
        [id, tenantId]
      ),
      this.db.query(
        `
          SELECT
            id,
            tenant_id,
            sale_item_id,
            tax_id,
            tax_name,
            tax_rate,
            tax_amount,
            is_included,
            created_at
          FROM sale_item_taxes
          WHERE sale_item_id IN (
            SELECT id
            FROM sale_items
            WHERE sale_id = $1
              AND tenant_id = $2
          )
            AND tenant_id = $2
          ORDER BY created_at ASC, id ASC
        `,
        [id, tenantId]
      ),
      this.db.query(
        `
          SELECT
            id,
            tenant_id,
            sale_id,
            payment_method,
            amount,
            reference,
            created_at
          FROM sale_payment_methods
          WHERE sale_id = $1
            AND tenant_id = $2
          ORDER BY created_at ASC, id ASC
        `,
        [id, tenantId]
      ),
    ]);

    return {
      ...this.mapSaleSummary(saleRow),
      items: (itemsResult.rows as SaleItemRow[]).map((row) => this.mapSaleItem(row)),
      itemTaxes: (itemTaxesResult.rows as SaleItemTaxRow[]).map((row) =>
        this.mapSaleItemTax(row)
      ),
      paymentMethods: (paymentMethodsResult.rows as SalePaymentMethodRow[]).map((row) =>
        this.mapSalePaymentMethod(row)
      ),
      payment_methods: (paymentMethodsResult.rows as SalePaymentMethodRow[]).map((row) =>
        this.mapSalePaymentMethod(row)
      ),
    };
  }

  async cancelSale(id: string, tenantId: string) {
    const result = (await this.db.query(
      `
        SELECT *
        FROM inventory_cancel_sale(
          $1::uuid,
          $2::uuid
        )
      `,
      [id, tenantId]
    )) as { rows: SaleRow[] };

    if (!result.rows[0]) {
      throw new NotFoundException("sale not found");
    }

    return this.mapSale(result.rows[0]);
  }
}
