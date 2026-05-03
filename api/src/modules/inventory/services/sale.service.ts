import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { CreatePaymentDto } from "../../finance/payments/dto/create-payment.dto";
import {
  PaymentsRepository,
  type PaymentAllocationRecord,
  type PaymentRecord,
} from "../../finance/payments/payments.repository";
import { PaymentsService } from "../../finance/payments/payments.service";
import { AuditService } from "../../../common/services/audit.service";
import { SaleEntity, type SaleType } from "../entities/sale.entity";
import { SaleItemEntity } from "../entities/sale-item.entity";
import {
  SaleItemTaxEntity,
} from "../entities/sale-item-tax.entity";
import type { StockMovementEntity } from "../entities/stock-movement.entity";
import {
  SalePaymentMethodEntity,
} from "../entities/sale-payment-method.entity";
import {
  SaleRepository,
  type CreateSalePaymentInput,
  type CreateSaleInput,
  type SaleRow,
} from "../repositories/sale.repository";
import { StockMovementService } from "./stock-movement.service";

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
  payment_method: string;
  amount: string | number;
  reference: string | null;
  created_at: Date;
};

type InvoiceableOrderRow = {
  id: string;
  customer_id: string;
  type: SaleType;
};

type InvoiceableOrderItemRow = {
  id: string;
  product_id: string;
  delivered_quantity: string | number;
  billed_quantity: string | number;
  price: string | number;
};

type SaleContext = {
  userId?: string;
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  posSessionId?: string;
  sessionId?: string;
  roles?: string[];
};

type InheritableOrderPayment = {
  payment: PaymentRecord;
  availableAmount: number;
};

@Injectable()
export class SaleService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(SaleRepository) private readonly repository: SaleRepository,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService,
    @Inject(PaymentsRepository)
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService
  ) {}

  private toNumber(value: string | number) {
    return typeof value === "number" ? value : Number(value);
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
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
      paymentStatus: row.payment_status,
      totalPaid: this.toNumber(row.total_paid),
      balanceDue: this.toNumber(row.balance_due),
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
    const paymentMethod = (
      row.payment_method === "BANK"
        ? "TRANSFER"
        : row.payment_method === "DIGITAL" || row.payment_method === "CREDIT"
          ? "OTHER"
          : row.payment_method
    ) as "CASH" | "CARD" | "TRANSFER" | "OTHER";
    return SalePaymentMethodEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      saleId: row.sale_id,
      paymentMethod,
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

  private normalizePayments(payments: CreateSalePaymentInput[] | undefined) {
    return (payments ?? []).map((payment) => {
      if (!payment.paymentMethodId) {
        throw new BadRequestException("paymentMethodId is required");
      }

      const amount = this.roundCurrency(Number(payment.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException("payment amount must be a positive number");
      }

      return {
        paymentMethodId: payment.paymentMethodId,
        amount,
        cashSessionId: payment.cashSessionId ?? null,
        referenceNumber: payment.referenceNumber ?? null,
        notes: payment.notes ?? null,
      };
    });
  }

  private buildFinanceActor(context: SaleContext) {
    if (!context.userId || !context.tenantId) {
      throw new UnauthorizedException("Incomplete POS context");
    }

    return {
      userId: context.userId,
      tenantId: context.tenantId,
      roles: Array.isArray(context.roles) ? context.roles : [],
      sessionId: context.sessionId,
    };
  }

  private async listInheritableOrderPayments(
    tenantId: string,
    orderId: string,
    client: PoolClient
  ): Promise<InheritableOrderPayment[]> {
    const payments = await this.paymentsRepository.list({
      tenantId,
      referenceType: "SALES_ORDER",
      referenceId: orderId,
      status: undefined,
      branchId: undefined,
      branchIds: undefined,
      paymentMethodId: undefined,
      cashSessionId: undefined,
      direction: undefined,
      createdBy: undefined,
      limit: 500,
      offset: 0,
    });

    const eligiblePayments = payments.filter((payment) =>
      payment.status === "PENDING" || payment.status === "COMPLETED"
    );

    const allocations = await this.paymentsRepository.listAllocationsByPaymentIds(
      eligiblePayments.map((payment) => payment.id),
      client
    );

    const orderAllocatedByPayment = allocations.reduce<Record<string, number>>(
      (acc, allocation: PaymentAllocationRecord) => {
        if (
          allocation.reference_type !== "SALES_ORDER" ||
          allocation.reference_id !== orderId
        ) {
          return acc;
        }
        acc[allocation.payment_id] =
          (acc[allocation.payment_id] ?? 0) + this.toNumber(allocation.allocated_amount);
        return acc;
      },
      {}
    );

    return eligiblePayments
      .map((payment) => ({
        payment,
        availableAmount: this.roundCurrency(
          Math.max(orderAllocatedByPayment[payment.id] ?? 0, 0)
        ),
      }))
      .filter((item) => item.availableAmount > 0)
      .sort((left, right) => {
        const leftTime = new Date(left.payment.created_at).getTime();
        const rightTime = new Date(right.payment.created_at).getTime();
        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }
        return left.payment.id.localeCompare(right.payment.id);
      });
  }

  private async applyInheritedOrderPaymentsToSale(
    tenantId: string,
    orderId: string,
    saleId: string,
    saleTotal: number,
    client: PoolClient
  ) {
    const orderPayments = await this.listInheritableOrderPayments(tenantId, orderId, client);
    const allocations = await this.paymentsRepository.listAllocationsByPaymentIds(
      orderPayments.map((item) => item.payment.id),
      client
    );
    const orderAllocations = allocations
      .filter(
        (allocation) =>
          allocation.reference_type === "SALES_ORDER" &&
          allocation.reference_id === orderId
      )
      .sort((left, right) => {
        const leftTime = new Date(left.created_at).getTime();
        const rightTime = new Date(right.created_at).getTime();
        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }
        return left.id.localeCompare(right.id);
      });

    let remaining = this.roundCurrency(saleTotal);
    let inheritedTotal = 0;

    for (const allocation of orderAllocations) {
      if (remaining <= 0) {
        break;
      }

      const allocatedAmount = this.roundCurrency(
        Math.min(this.toNumber(allocation.allocated_amount), remaining)
      );

      if (allocatedAmount <= 0) {
        continue;
      }

      const originalAmount = this.roundCurrency(this.toNumber(allocation.allocated_amount));

      if (allocatedAmount === originalAmount) {
        await this.paymentsRepository.updateAllocation(client, allocation.id, {
          referenceType: "SALE",
          referenceId: saleId,
        });
      } else {
        await this.paymentsRepository.updateAllocation(client, allocation.id, {
          allocatedAmount: this.roundCurrency(originalAmount - allocatedAmount),
        });
        await this.paymentsRepository.createAllocations(client, allocation.payment_id, [
          {
            referenceType: "SALE",
            referenceId: saleId,
            allocatedAmount,
          },
        ]);
      }

      inheritedTotal = this.roundCurrency(inheritedTotal + allocatedAmount);
      remaining = this.roundCurrency(remaining - allocatedAmount);
    }

    return inheritedTotal;
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

      const validCustomer = await this.repository.validateCustomer(
        saleContext.tenantId,
        data.customerId,
        client
      );
      if (!validCustomer) {
        throw new BadRequestException("customer not found for tenant");
      }
      if (data.orderId) {
        const validOrder = await this.repository.validateOrder(
          saleContext.tenantId,
          data.orderId,
          client
        );
        if (!validOrder) {
          throw new BadRequestException("order not found for tenant");
        }
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

      let total = 0;
      const createdMovements: StockMovementEntity[] = [];

      for (const item of data.items) {
        const quantity = this.roundCurrency(Number(item.quantity));
        const price = this.roundCurrency(Number(item.price));

        if (!item.productId) {
          throw new BadRequestException("productId is required");
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new BadRequestException("quantity must be a positive number");
        }
        if (!Number.isFinite(price) || price < 0) {
          throw new BadRequestException("price must be a non-negative number");
        }

        const product = await this.repository.getProductForSale(
          saleContext.tenantId,
          item.productId,
          client
        );
        if (!product) {
          throw new BadRequestException("product not found for tenant");
        }

        if (item.orderItemId) {
          if (!data.orderId) {
            throw new BadRequestException(
              "orderId is required when orderItemId is provided"
            );
          }

          const orderItem = await this.repository.getOrderItemForUpdate(
            saleContext.tenantId,
            data.orderId,
            item.orderItemId,
            client
          );
          if (!orderItem) {
            throw new BadRequestException("order item not found for order and tenant");
          }

          const remainingOrderQuantity =
            this.toNumber(orderItem.ordered_quantity) -
            this.toNumber(orderItem.delivered_quantity);
          if (quantity > remainingOrderQuantity) {
            throw new BadRequestException(
              `sale quantity exceeds pending quantity for order item ${item.orderItemId}`
            );
          }
        } else if (data.orderId) {
          throw new BadRequestException(
            "orderItemId is required for sale items linked to an order"
          );
        }

        const availableStock = await this.repository.getAvailableStock(
          saleContext.tenantId,
          item.productId,
          client
        );
        if (availableStock < quantity) {
          throw new BadRequestException(
            `insufficient stock for product ${item.productId}`
          );
        }

        const taxRate = this.toNumber(product.tax_rate ?? 0);
        const priceWithoutTax =
          taxRate > 0 ? this.roundCurrency(price / (1 + taxRate)) : price;
        const taxTotal =
          taxRate > 0
            ? this.roundCurrency((price - priceWithoutTax) * quantity)
            : 0;
        const subtotal = this.roundCurrency(price * quantity);
        total = this.roundCurrency(total + subtotal);

        const saleItemId = await this.repository.insertSaleItem(
          saleRow.id,
          saleContext.tenantId,
          {
            productId: item.productId,
            orderItemId: item.orderItemId ?? null,
            quantity,
            price,
            priceWithoutTax,
            taxTotal,
            subtotal,
          },
          client
        );

        if (product.tax_id && product.tax_name) {
          await this.repository.insertSaleItemTax(
            saleContext.tenantId,
            saleItemId,
            {
              taxId: product.tax_id,
              taxName: product.tax_name,
              taxRate,
              taxAmount: taxTotal,
              isIncluded: product.tax_is_included ?? false,
            },
            client
          );
        }

        const movement = await this.stockMovementService.createMovement(
          {
            id: crypto.randomUUID(),
            tenantId: saleContext.tenantId,
            productId: item.productId,
            type: "OUT",
            quantity,
            referenceType: "SALE",
            referenceId: saleRow.id,
            branchId: saleContext.branchId,
            terminalId: saleContext.terminalId,
            posSessionCode: saleContext.posSessionId,
            userId: saleContext.userId,
            referenceTable: "sales",
            createdAt: new Date(),
          },
          client
        );
        createdMovements.push(movement);

        if (item.orderItemId) {
          await this.repository.updateOrderItemDeliveredQuantity(
            item.orderItemId,
            quantity,
            client
          );
          await this.repository.updateOrderItemBilledQuantity(
            item.orderItemId,
            quantity,
            client
          );
        }
      }

      const payments = this.normalizePayments(data.payments);
      await this.repository.initializeSaleFinancials(
        saleRow.id,
        saleContext.tenantId,
        total,
        client
      );

      for (const payment of payments) {
        const payload = Object.assign(new CreatePaymentDto(), {
          branchId: saleContext.branchId,
          paymentMethodId: payment.paymentMethodId,
          cashSessionId: payment.cashSessionId,
          referenceType: "SALE",
          referenceId: saleRow.id,
          direction: "IN",
          status: "COMPLETED",
          amount: payment.amount,
          referenceNumber: payment.referenceNumber,
          notes: payment.notes,
        });

        await this.paymentsService.createInTransaction(
          payload,
          this.buildFinanceActor(saleContext),
          client
        );
      }

      if (data.orderId) {
        await this.repository.refreshOrderStatus(
          data.orderId,
          saleContext.tenantId,
          client
        );
      }

      await client.query("COMMIT");
      createdMovements.forEach((movement) =>
        this.stockMovementService.logMovementAuditEvent(movement)
      );
      this.auditService.logEvent({
        tenantId: saleContext.tenantId,
        userId: saleContext.userId,
        module: "sales",
        entity: "sales",
        entityId: saleRow.id,
        action: "SALE_CREATED",
      });

      return this.getSaleById(saleRow.id, saleContext.tenantId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createSaleFromOrderDelivery(
    data: {
      orderId: string;
      type: SaleType;
      payments?: CreateSalePaymentInput[];
    },
    context: SaleContext
  ) {
    const saleContext = await this.normalizeSaleContext(context);

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

      const orderResult = await client.query<InvoiceableOrderRow>(
        `
          SELECT id, customer_id, type
          FROM orders
          WHERE id = $1
            AND tenant_id = $2
            AND status IN ('PARTIAL', 'COMPLETED')
          LIMIT 1
        `,
        [data.orderId, saleContext.tenantId]
      );
      const order = orderResult.rows[0];
      if (!order) {
        throw new BadRequestException("order not found or not ready for invoicing");
      }

      const validCustomer = await this.repository.validateCustomer(
        saleContext.tenantId,
        order.customer_id,
        client
      );
      if (!validCustomer) {
        throw new BadRequestException("customer not found for tenant");
      }

      const itemsResult = await client.query<InvoiceableOrderItemRow>(
        `
          SELECT
            oi.id,
            oi.product_id,
            oi.delivered_quantity,
            COALESCE(oi.billed_quantity, 0) AS billed_quantity,
            oi.price
          FROM order_items oi
          WHERE oi.order_id = $1
            AND oi.delivered_quantity > COALESCE(oi.billed_quantity, 0)
          ORDER BY oi.id
          FOR UPDATE
        `,
        [data.orderId]
      );
      if (itemsResult.rows.length === 0) {
        throw new BadRequestException("order has no delivered items pending invoicing");
      }

      const saleRow = await this.repository.createSale(
        {
          tenantId: saleContext.tenantId,
          branchId: saleContext.branchId,
          terminalId: saleContext.terminalId,
          userId: saleContext.userId,
          posSessionId: saleContext.posSessionId,
          customerId: order.customer_id,
          orderId: data.orderId,
          type: data.type,
          items: [],
          payments: data.payments ?? [],
        },
        client
      );
      if (!saleRow) {
        throw new BadRequestException("sale could not be created");
      }

      let total = 0;
      for (const item of itemsResult.rows) {
        const quantity = this.roundCurrency(
          this.toNumber(item.delivered_quantity) - this.toNumber(item.billed_quantity)
        );
        if (quantity <= 0) {
          continue;
        }

        const price = this.roundCurrency(this.toNumber(item.price));
        const product = await this.repository.getProductForSale(
          saleContext.tenantId,
          item.product_id,
          client
        );
        if (!product) {
          throw new BadRequestException("product not found for tenant");
        }

        const taxRate = this.toNumber(product.tax_rate ?? 0);
        const priceWithoutTax =
          taxRate > 0 ? this.roundCurrency(price / (1 + taxRate)) : price;
        const taxTotal =
          taxRate > 0
            ? this.roundCurrency((price - priceWithoutTax) * quantity)
            : 0;
        const subtotal = this.roundCurrency(price * quantity);
        total = this.roundCurrency(total + subtotal);

        const saleItemId = await this.repository.insertSaleItem(
          saleRow.id,
          saleContext.tenantId,
          {
            productId: item.product_id,
            orderItemId: item.id,
            quantity,
            price,
            priceWithoutTax,
            taxTotal,
            subtotal,
          },
          client
        );

        if (product.tax_id && product.tax_name) {
          await this.repository.insertSaleItemTax(
            saleContext.tenantId,
            saleItemId,
            {
              taxId: product.tax_id,
              taxName: product.tax_name,
              taxRate,
              taxAmount: taxTotal,
              isIncluded: product.tax_is_included ?? false,
            },
            client
          );
        }

        await this.repository.updateOrderItemBilledQuantity(item.id, quantity, client);
      }

      const payments = this.normalizePayments(data.payments);
      await this.repository.initializeSaleFinancials(
        saleRow.id,
        saleContext.tenantId,
        total,
        client
      );

      const inheritedTotal = await this.applyInheritedOrderPaymentsToSale(
        saleContext.tenantId,
        data.orderId,
        saleRow.id,
        total,
        client
      );

      await this.paymentsRepository.syncSaleFinancialState(
        client,
        saleRow.id,
        saleContext.tenantId
      );

      const paymentsTotal = this.roundCurrency(
        payments.reduce((sum, payment) => sum + payment.amount, 0)
      );
      const coveredTotal = this.roundCurrency(inheritedTotal + paymentsTotal);

      if (data.type === "CASH" && coveredTotal !== this.roundCurrency(total)) {
        throw new BadRequestException(
          "Las ventas CASH generadas desde orden deben quedar totalmente cubiertas entre abonos heredados y pagos nuevos"
        );
      }

      if (coveredTotal > this.roundCurrency(total)) {
        throw new BadRequestException(
          "Los pagos heredados y nuevos no pueden superar el total a facturar"
        );
      }

      for (const payment of payments) {
        const payload = Object.assign(new CreatePaymentDto(), {
          branchId: saleContext.branchId,
          paymentMethodId: payment.paymentMethodId,
          cashSessionId: payment.cashSessionId,
          referenceType: "SALE",
          referenceId: saleRow.id,
          direction: "IN",
          status: "COMPLETED",
          amount: payment.amount,
          referenceNumber: payment.referenceNumber,
          notes: payment.notes,
        });

        await this.paymentsService.createInTransaction(
          payload,
          this.buildFinanceActor(saleContext),
          client
        );
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

      return this.getSaleById(saleRow.id, saleContext.tenantId);
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
          s.payment_status,
          s.total_paid,
          s.balance_due,
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
          s.payment_status,
          s.total_paid,
          s.balance_due,
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
            allocation.id,
            payment.tenant_id,
            allocation.reference_id AS sale_id,
            CASE
              WHEN method.tipo = 'BANK' THEN 'TRANSFER'
              WHEN method.tipo IN ('DIGITAL', 'CREDIT') THEN 'OTHER'
              ELSE method.tipo
            END AS payment_method,
            allocation.allocated_amount AS amount,
            COALESCE(payment.reference_number, payment.notes) AS reference,
            allocation.created_at
          FROM payment_allocations AS allocation
          INNER JOIN payments AS payment
            ON payment.id = allocation.payment_id
          INNER JOIN payment_methods AS method
            ON method.id = payment.payment_method_id
           AND method.tenant_id = payment.tenant_id
          WHERE allocation.reference_type = 'SALE'
            AND allocation.reference_id = $1
            AND payment.tenant_id = $2
            AND payment.status IN ('PENDING', 'COMPLETED')
          ORDER BY allocation.created_at ASC, allocation.id ASC
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
