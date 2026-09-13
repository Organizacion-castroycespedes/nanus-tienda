import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { CreatePaymentDto } from "../../finance/payments/dto/create-payment.dto";
import { FinanceAccessRepository } from "../../finance/common/repositories/finance-access.repository";
import { ElectronicInvoicingCustomersRepository } from "../../electronic-invoicing/customers/electronic-invoicing-customers.repository";
import {
  PaymentsRepository,
  type PaymentAllocationRecord,
  type PaymentRecord,
} from "../../finance/payments/payments.repository";
import { PaymentsService } from "../../finance/payments/payments.service";
import { PricingService } from "../../pricing/pricing.service";
import type { LinePricePreview } from "../../pricing/pricing.types";
import { AuditService } from "../../../common/services/audit.service";
import { CustomerRepository } from "../repositories/customer.repository";
import { ProductRepository } from "../repositories/product.repository";
import { TaxRepository } from "../repositories/tax.repository";
import { buildSaleCompletedForElectronicBillingEventId } from "../mappers/sale-completed-for-electronic-billing-event-id";
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
import {
  canViewAllBranches,
  hasBranchScopedRole,
  normalizeOptionalFilter,
  type BranchScopedActor,
  type BranchScopedFilters,
} from "../utils/access";
import { IntegrationOutboxService } from "../../integration-outbox/services/integration-outbox.service";
import type {
  BuildSaleCompletedForElectronicBillingEventInput,
  SaleLineSnapshot,
  SalePaymentSnapshot,
  SaleTaxSnapshot,
  SaleCustomerSnapshot,
} from "../../integration-outbox/contracts/integration-outbox-events";
import {
  evaluateElectronicBillingEligibility,
} from "../../integration-outbox/contracts/electronic-billing-eligibility";
import {
  assertIssuerCanBillVat,
  hasPositiveTaxLines,
} from "../../integration-outbox/contracts/issuer-vat-billing-guard";
import {
  getElectronicBillingMode,
} from "../../integration-outbox/contracts/electronic-billing-mode";
import { StockMovementService } from "./stock-movement.service";
import {
  normalizeVatResponsibility,
  type VatResponsibility,
} from "../../tenants/vat-responsibility";

type SaleListRow = SaleRow & {
  branch_id: string;
  customer_name: string | null;
};

type SaleDetailRow = SaleRow & {
  branch_id: string;
  terminal_id: string | null;
  user_id: string | null;
  pos_session_id: string | null;
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
  line_total: string | number | null;
  pricing_source: string | null;
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

type SaleStockMovementRow = {
  id: string;
  product_id: string;
  quantity: string | number;
  branch_id: string | null;
  terminal_id: string | null;
  pos_session_code: string | null;
  user_id: string | null;
};

type SaleStockMovementLotRow = {
  id: string;
  product_id: string;
  lot_id: string | null;
  location_id: string | null;
  quantity: string | number;
};

type SaleLotRow = {
  id: string;
  status: string;
  branch_id: string;
  product_id: string;
};

type ProductLotRequirementRow = {
  id: string;
  requires_lot: boolean;
};

type PricedSaleItem = {
  saleItemId: string;
  productId: string;
  quantity: number;
  price: number;
  orderItemId?: string | null;
  subtotal: number;
  priceWithoutTax: number;
  taxTotal: number;
  baseUnitPrice?: number;
  finalUnitPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  discountTotal?: number;
  appliedPromotionId?: string | null;
  appliedPromotionName?: string | null;
  taxId?: string | null;
  taxRate?: number | null;
  taxBase?: number;
  taxAmount?: number;
  lineTotal?: number;
  pricingSnapshot?: Record<string, unknown>;
  pricingCalculatedAt?: Date;
  pricingSource?: string | null;
};

type InheritableOrderPayment = {
  payment: PaymentRecord;
  availableAmount: number;
};

type CreatedPaymentSnapshot = {
  paymentMethodTipo: string | null;
  amount: number;
  reference: string | null;
};

type InheritedOrderPaymentResult = {
  inheritedTotal: number;
  inheritedPayments: CreatedPaymentSnapshot[];
};

const POS_PRICING_SOURCE = "POS_PRICING_SERVICE";

@Injectable()
export class SaleService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(SaleRepository) private readonly repository: SaleRepository,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService,
    @Inject(FinanceAccessRepository)
    private readonly financeAccessRepository: FinanceAccessRepository,
    @Inject(PaymentsRepository)
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
    @Inject(PricingService)
    private readonly pricingService: PricingService,
    @Optional()
    @Inject(IntegrationOutboxService)
    private readonly integrationOutboxService?: IntegrationOutboxService,
    @Optional()
    @Inject(CustomerRepository)
    private readonly customerRepository?: CustomerRepository,
    @Optional()
    @Inject(ProductRepository)
    private readonly productRepository?: ProductRepository,
    @Optional()
    @Inject(TaxRepository)
    private readonly taxRepository?: TaxRepository,
    @Optional()
    @Inject(ElectronicInvoicingCustomersRepository)
    private readonly electronicInvoicingCustomersRepository?: ElectronicInvoicingCustomersRepository
  ) {}

  private toNumber(value: string | number) {
    return typeof value === "number" ? value : Number(value);
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }

  private toDecimalWireValue(value: number | string | null | undefined) {
    if (value === null || value === undefined) {
      return "0.00";
    }

    const numericValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numericValue)) {
      return "0.00";
    }

    return this.roundCurrency(numericValue).toFixed(2);
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
      branchId: row.branch_id,
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
      lineTotal: row.line_total == null ? null : this.toNumber(row.line_total),
      pricingSource: row.pricing_source,
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
        sessionId: context.sessionId,
        roles: Array.isArray(context.roles) ? context.roles : [],
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
      sessionId: context.sessionId,
      roles: Array.isArray(context.roles) ? context.roles : [],
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

  private async buildLegacySalePaymentMethods(
    tenantId: string,
    payments: ReturnType<SaleService["normalizePayments"]>,
    client: PoolClient
  ) {
    const paymentMethodIds = [...new Set(payments.map((payment) => payment.paymentMethodId))];
    const paymentMethodTypes = await this.repository.findPaymentMethodTypesByIds(
      tenantId,
      paymentMethodIds,
      client
    );

    return payments.map((payment) => {
      const paymentMethod = paymentMethodTypes.get(payment.paymentMethodId);
      if (!paymentMethod) {
        throw new BadRequestException("payment method not found for tenant");
      }

      return {
        paymentMethod,
        amount: payment.amount,
        reference: payment.referenceNumber ?? payment.notes ?? null,
      };
    });
  }

  private async loadPricedSaleItemsForBilling(
    saleId: string,
    tenantId: string,
    client: PoolClient
  ) {
    const result = await client.query<{
      id: string;
      product_id: string;
      quantity: string | number;
      price: string | number;
      order_item_id: string | null;
      subtotal: string | number;
      price_without_tax: string | number;
      tax_total: string | number;
      base_unit_price: string | number | null;
      final_unit_price: string | number | null;
      discount_amount: string | number | null;
      discount_percent: string | number | null;
      discount_total: string | number | null;
      tax_id: string | null;
      tax_rate: string | number | null;
      tax_base: string | number | null;
      tax_amount: string | number | null;
      line_total: string | number | null;
      pricing_source: string | null;
      created_at: Date;
    }>(
      `
        WITH sale_item_tax_snapshot AS (
          SELECT DISTINCT ON (taxes.sale_item_id)
            taxes.sale_item_id,
            taxes.tenant_id,
            taxes.tax_id,
            taxes.tax_rate,
            taxes.tax_amount
          FROM sale_item_taxes AS taxes
          WHERE taxes.sale_item_id IN (
            SELECT id
            FROM sale_items
            WHERE sale_id = $1
              AND tenant_id = $2
          )
          ORDER BY taxes.sale_item_id, taxes.created_at ASC, taxes.id ASC
        )
        SELECT
          si.id,
          si.product_id,
          si.quantity,
          si.price,
          si.order_item_id,
          si.subtotal,
          si.price_without_tax,
          si.tax_total,
          si.base_unit_price,
          si.final_unit_price,
          si.discount_amount,
          si.discount_percent,
          si.discount_total,
          sit.tax_id,
          sit.tax_rate,
          si.tax_base,
          COALESCE(si.tax_amount, sit.tax_amount) AS tax_amount,
          si.line_total,
          si.pricing_source,
          si.created_at
        FROM sale_items AS si
        LEFT JOIN sale_item_tax_snapshot AS sit
          ON sit.sale_item_id = si.id
         AND sit.tenant_id = si.tenant_id
        WHERE si.sale_id = $1
          AND si.tenant_id = $2
        ORDER BY si.created_at ASC, si.id ASC
      `,
      [saleId, tenantId]
    );

    return result.rows.map((row) => ({
      saleItemId: row.id,
      productId: row.product_id,
      quantity: this.toNumber(row.quantity),
      price: this.toNumber(row.price),
      orderItemId: row.order_item_id,
      subtotal: this.toNumber(row.subtotal),
      priceWithoutTax: this.toNumber(row.price_without_tax),
      taxTotal: this.toNumber(row.tax_total),
      baseUnitPrice:
        row.base_unit_price == null ? undefined : this.toNumber(row.base_unit_price),
      finalUnitPrice:
        row.final_unit_price == null ? undefined : this.toNumber(row.final_unit_price),
      discountAmount:
        row.discount_amount == null ? undefined : this.toNumber(row.discount_amount),
      discountPercent:
        row.discount_percent == null ? undefined : this.toNumber(row.discount_percent),
      discountTotal:
        row.discount_total == null ? undefined : this.toNumber(row.discount_total),
      taxId: row.tax_id,
      taxRate: row.tax_rate == null ? null : this.toNumber(row.tax_rate),
      taxBase: row.tax_base == null ? undefined : this.toNumber(row.tax_base),
      taxAmount: row.tax_amount == null ? undefined : this.toNumber(row.tax_amount),
      lineTotal: row.line_total == null ? undefined : this.toNumber(row.line_total),
      pricingSource: row.pricing_source,
      pricingCalculatedAt: row.created_at,
    })) as PricedSaleItem[];
  }

  private buildPosPricingSnapshot(input: {
    tenantId: string;
    branchId: string;
    customerId: string;
    pricingCalculatedAt: Date;
    preview: LinePricePreview;
  }) {
    return {
      channel: "POS",
      tenantId: input.tenantId,
      branchId: input.branchId,
      customerId: input.customerId,
      calculatedAt: input.pricingCalculatedAt.toISOString(),
      productId: input.preview.productId,
      quantity: input.preview.quantity,
      result: input.preview,
    };
  }

  private async calculatePricedPosItems(input: {
    tenantId: string;
    branchId: string;
    customerId: string;
    items: Omit<CreateSaleInput, "tenantId" | "branchId" | "terminalId" | "userId" | "posSessionId">["items"];
    pricingCalculatedAt: Date;
  }) {
    const pricingDate = input.pricingCalculatedAt.toISOString();
    const items: CreateSaleInput["items"] = [];

    for (const item of input.items) {
      const preview = await this.pricingService.calculateLinePrice({
        tenantId: input.tenantId,
        branchId: input.branchId,
        customerId: input.customerId,
        productId: item.productId,
        quantity: item.quantity,
        channel: "POS",
        date: pricingDate,
      });
      const discountTotal = this.roundCurrency(
        preview.discountAmount * preview.quantity
      );
      const priceWithoutTax =
        preview.quantity > 0
          ? this.roundCurrency(preview.taxBase / preview.quantity)
          : 0;

      items.push({
        productId: item.productId,
        quantity: preview.quantity,
        price: preview.finalUnitPrice,
        orderItemId: item.orderItemId ?? null,
        subtotal: preview.lineTotal,
        priceWithoutTax,
        taxTotal: preview.taxAmount,
        baseUnitPrice: preview.baseUnitPrice,
        finalUnitPrice: preview.finalUnitPrice,
        discountAmount: preview.discountAmount,
        discountPercent: preview.discountPercent,
        discountTotal,
        appliedPromotionId: preview.appliedPromotionId,
        appliedPromotionName: preview.appliedPromotionName,
        taxId: preview.taxId,
        taxRate: preview.taxRate,
        taxBase: preview.taxBase,
        taxAmount: preview.taxAmount,
        lineTotal: preview.lineTotal,
        pricingSnapshot: this.buildPosPricingSnapshot({
          tenantId: input.tenantId,
          branchId: input.branchId,
          customerId: input.customerId,
          pricingCalculatedAt: input.pricingCalculatedAt,
          preview,
        }),
        pricingCalculatedAt: input.pricingCalculatedAt,
        pricingSource: POS_PRICING_SOURCE,
      });
    }

    return items;
  }

  private calculateBackendSaleTotal(items: CreateSaleInput["items"]) {
    return this.roundCurrency(
      items.reduce((sum, item) => sum + (item.lineTotal ?? item.subtotal ?? 0), 0)
    );
  }

  private ensureCashPaymentsMatchBackendTotal(
    type: SaleType,
    payments: ReturnType<SaleService["normalizePayments"]>,
    backendTotal: number
  ) {
    if (type !== "CASH") {
      return;
    }

    const paymentTotal = this.roundCurrency(
      payments.reduce((sum, payment) => sum + payment.amount, 0)
    );
    if (paymentTotal !== backendTotal) {
      throw new BadRequestException(
        "Payment total does not match backend calculated sale total"
      );
    }
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

  private normalizeInvoiceDocumentNumber(value?: string | null) {
    const normalized = value?.trim().toUpperCase().replace(/[^0-9A-Z]/g, "") ?? "";
    return normalized.length > 0 ? normalized : null;
  }

  private async buildElectronicBillingCustomerSnapshot(
    tenantId: string,
    customerId: string,
    client: PoolClient
  ): Promise<SaleCustomerSnapshot> {
    if (!this.customerRepository) {
      throw new BadRequestException("customer repository is not configured");
    }

    const customer = await this.customerRepository.findById(customerId, tenantId, client);
    if (!customer) {
      throw new BadRequestException("customer not found for tenant");
    }

    const normalizedDocument = this.normalizeInvoiceDocumentNumber(customer.documentNumber);
    const fiscalCustomer = this.electronicInvoicingCustomersRepository
      ? (typeof this.electronicInvoicingCustomersRepository.findById === "function"
          ? await this.electronicInvoicingCustomersRepository.findById(customerId, tenantId)
          : null) ??
        (normalizedDocument
          ? await this.electronicInvoicingCustomersRepository.findByNormalizedDocument(
              tenantId,
              normalizedDocument,
            )
          : null)
      : null;
    const finalConsumerCustomer =
      !fiscalCustomer && customer.isFinalConsumer && this.electronicInvoicingCustomersRepository
        ? await this.electronicInvoicingCustomersRepository.findActiveFinalConsumer(tenantId)
        : null;
    const resolvedCustomer = fiscalCustomer ?? finalConsumerCustomer;

    const identificationNumber =
      resolvedCustomer?.identificationNumber ??
      resolvedCustomer?.documentNumberNormalized ??
      customer.documentNumber ??
      null;
    if (!identificationNumber) {
      throw new BadRequestException("customer identification number is required for invoice");
    }

    const legalName =
      resolvedCustomer?.legalName ??
      resolvedCustomer?.tradeName ??
      customer.name;

    return {
      customerType:
        resolvedCustomer?.personType === "NATURAL"
          ? "PERSON"
          : resolvedCustomer?.personType === "JURIDICA"
            ? "COMPANY"
            : customer.isFinalConsumer
              ? "PERSON"
              : "COMPANY",
      identificationType:
        resolvedCustomer?.dianIdentificationType ??
        resolvedCustomer?.documentTypeCode ??
        null,
      identificationTypeCode:
        resolvedCustomer?.dianIdentificationType ??
        resolvedCustomer?.documentTypeCode ??
        null,
      identificationNumber,
      verificationDigit: resolvedCustomer?.verificationDigit ?? null,
      legalName,
      email: resolvedCustomer?.invoiceEmail ?? resolvedCustomer?.fiscalEmail ?? customer.email,
      phone: resolvedCustomer?.phone ?? customer.phone,
      addressLine1: resolvedCustomer?.address ?? customer.address,
      countryCode: "CO",
      departmentCode: resolvedCustomer?.departmentCode ?? null,
      municipalityCode: resolvedCustomer?.municipalityCode ?? null,
      cityName: customer.ciudad ?? null,
      departmentName: customer.departamento ?? null,
      countryName: "Colombia",
      taxLevelCode: resolvedCustomer?.personType ?? null,
      taxSchemeId:
        resolvedCustomer?.taxRegime ?? resolvedCustomer?.documentTypeCode ?? null,
      taxSchemeName:
        resolvedCustomer?.taxRegime ?? resolvedCustomer?.documentTypeCode ?? null,
      fiscalResponsibilityCodes: resolvedCustomer?.taxResponsibilities ?? null,
      metadata: {
        source: "sales.customer",
        customerId: customer.id,
        tenantId: customer.tenantId,
        isFinalConsumer: customer.isFinalConsumer,
        documentNumber: customer.documentNumber ?? null,
      },
    };
  }

  private async buildElectronicBillingLines(
    tenantId: string,
    items: PricedSaleItem[]
  ) {
    const productRepository = this.productRepository;
    if (!productRepository) {
      throw new BadRequestException("product repository is not configured");
    }
    const taxRepository = this.taxRepository;

    const lines = await Promise.all(
      items.map(async (item) => {
        const product = await productRepository.findById(
          item.productId,
          tenantId
        );
        if (!product) {
          throw new BadRequestException(`product not found for sale line ${item.productId}`);
        }

        const tax =
          item.taxId !== undefined && item.taxId !== null && taxRepository
            ? await taxRepository.findById(item.taxId, tenantId)
            : null;
        const subtotalAmount = this.roundCurrency(
          item.taxBase ?? item.priceWithoutTax * item.quantity
        );
        const discountAmount = this.roundCurrency(
          item.discountTotal ?? item.discountAmount ?? 0
        );
        const taxAmount = this.roundCurrency(item.taxAmount ?? item.taxTotal);
        const totalAmount = this.roundCurrency(
          item.lineTotal ?? item.subtotal ?? subtotalAmount + taxAmount - discountAmount
        );

        return {
          sourceLineId: item.saleItemId,
          productId: product.id,
          sku: product.sku,
          description: product.description ?? product.name,
          quantity: this.toDecimalWireValue(item.quantity),
          unitCode: product.measurementUnit,
          unitPrice: this.toDecimalWireValue(item.priceWithoutTax),
          discountAmount: this.toDecimalWireValue(discountAmount),
          subtotalAmount: this.toDecimalWireValue(subtotalAmount),
          taxAmount: this.toDecimalWireValue(taxAmount),
          totalAmount: this.toDecimalWireValue(totalAmount),
          taxTreatment: taxAmount > 0 ? "TAXED" : "EXCLUDED",
          standardItemId: product.id,
          standardItemSchemeId: "MANUS",
          taxes:
            taxAmount > 0 || item.taxId !== null || item.taxRate !== null
              ? [
                  {
                    type: tax?.name ?? item.taxId ?? "TAX",
                    code: item.taxId ?? null,
                    schemeId: item.taxId ?? null,
                    schemeName: tax?.name ?? null,
                    rate: this.toDecimalWireValue(item.taxRate ?? tax?.rate ?? 0),
                    taxableBase: this.toDecimalWireValue(subtotalAmount),
                    amount: this.toDecimalWireValue(taxAmount),
                    metadata: {
                      productId: product.id,
                      taxId: item.taxId ?? null,
                    },
                  },
                ]
              : [],
          metadata: {
            productId: product.id,
            sku: product.sku,
            saleItemId: item.saleItemId,
            orderItemId: item.orderItemId ?? null,
            pricingSource: item.pricingSource ?? null,
            pricingSnapshot: item.pricingSnapshot ?? null,
            baseUnitPrice: item.baseUnitPrice ?? null,
            finalUnitPrice: item.finalUnitPrice ?? null,
            discountPercent: item.discountPercent ?? null,
          },
        };
      })
    );

    return lines;
  }

  private buildElectronicBillingTaxes(lines: SaleLineSnapshot[]): SaleTaxSnapshot[] {
    return lines.flatMap((line) =>
      line.taxes.map((tax) => ({
        ...tax,
        sourceLineId: line.sourceLineId,
      }))
    );
  }

  private buildElectronicBillingPayments(
    legacyPaymentMethods: Array<{
      paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
      amount: number;
      reference?: string | null;
    }>,
    payments: ReturnType<SaleService["normalizePayments"]>
  ): SalePaymentSnapshot[] {
    if (payments.length === 0) {
      return [];
    }

    const term = payments.length === 1 ? "IMMEDIATE" : "MIXED";

    return payments.map((payment, index) => ({
      methodCode:
        legacyPaymentMethods[index]?.paymentMethod ??
        legacyPaymentMethods[0]?.paymentMethod ??
        "OTHER",
      amount: this.toDecimalWireValue(payment.amount),
      term,
      dueDate: null,
      reference: payment.referenceNumber ?? payment.notes ?? null,
      metadata: {
        index,
        paymentMethodId: payment.paymentMethodId,
        cashSessionId: payment.cashSessionId ?? null,
        paymentMethod: legacyPaymentMethods[index]?.paymentMethod ?? null,
        amount: payment.amount,
        reference: payment.referenceNumber ?? payment.notes ?? null,
      },
    }));
  }

  private async enqueueSaleCompletedForElectronicBilling(
    saleContext: SaleContext,
    saleRow: {
      id: string;
      customer_id: string;
      order_id: string | null;
      total: string | number;
      type: SaleType;
      status: string;
      created_at: string | Date;
    },
    pricedItems: PricedSaleItem[] | null,
    legacyPaymentMethods: Array<{
      paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
      amount: number;
      reference?: string | null;
    }> | null,
    payments: ReturnType<SaleService["normalizePayments"]>,
    client: PoolClient,
    billingSource: {
      customerId: string;
      orderId?: string | null;
      eventId?: string;
    },
    enqueueEvent = true,
  ) {
    const tenantId = saleContext.tenantId;
    if (!tenantId) {
      throw new BadRequestException("tenantId is required for sale billing outbox");
    }

    if (!this.integrationOutboxService) {
      return;
    }

    const effectivePricedItems = await this.loadPricedSaleItemsForBilling(
      saleRow.id,
      tenantId,
      client
    );
    const effectiveLegacyPaymentMethods =
      legacyPaymentMethods ??
      (await this.buildLegacySalePaymentMethods(tenantId, payments, client));

    const customer = await this.buildElectronicBillingCustomerSnapshot(
      tenantId,
      billingSource.customerId,
      client
    );
    const lines = await this.buildElectronicBillingLines(
      tenantId,
      effectivePricedItems
    );
    const issuerResult = await client.query<{ vat_responsibility: string | null }>(
      "SELECT vat_responsibility FROM tenants_detalles WHERE tenant_id = $1",
      [tenantId],
    );
    const issuerVatResponsibility: VatResponsibility = normalizeVatResponsibility(
      issuerResult.rows[0]?.vat_responsibility ?? "UNKNOWN",
    );
    try {
      assertIssuerCanBillVat(issuerVatResponsibility, hasPositiveTaxLines(lines));
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const totals = effectivePricedItems.reduce(
      (acc, item) => {
        acc.subtotalAmount += item.taxBase ?? item.priceWithoutTax * item.quantity;
        acc.discountAmount += item.discountTotal ?? item.discountAmount ?? 0;
        acc.taxAmount += item.taxAmount ?? item.taxTotal;
        acc.totalAmount += item.lineTotal ?? item.subtotal;
        return acc;
      },
      {
        subtotalAmount: 0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
      }
    );
    const lineSnapshots = lines;
    const taxSnapshots = this.buildElectronicBillingTaxes(lineSnapshots);
    const paymentSnapshots = this.buildElectronicBillingPayments(
      effectiveLegacyPaymentMethods,
      payments
    );
    const occurredAt =
      saleRow.created_at instanceof Date
        ? saleRow.created_at.toISOString()
        : new Date(saleRow.created_at).toISOString();

    const event: BuildSaleCompletedForElectronicBillingEventInput = {
      eventId:
        billingSource.eventId ?? buildSaleCompletedForElectronicBillingEventId(tenantId, saleRow.id),
      tenantId,
      correlationId: saleContext.sessionId ?? saleRow.id,
      occurredAt,
      sale: {
        saleId: saleRow.id,
        saleNumber: null,
        saleType: saleRow.type,
        saleStatus: saleRow.status,
        branchId: saleContext.branchId ?? null,
        terminalId: saleContext.terminalId ?? null,
        posSessionId: saleContext.posSessionId ?? null,
        orderId: saleRow.order_id ?? billingSource.orderId ?? null,
        completedAt: occurredAt,
        currencyCode: "COP",
      },
      customer,
      lines: lineSnapshots,
      taxes: taxSnapshots,
      payments: paymentSnapshots,
      totals: {
        subtotalAmount: this.toDecimalWireValue(totals.subtotalAmount),
        discountAmount: this.toDecimalWireValue(totals.discountAmount),
        taxAmount: this.toDecimalWireValue(totals.taxAmount),
        totalAmount: this.toDecimalWireValue(
          totals.totalAmount || this.toNumber(saleRow.total)
        ),
      },
      currencyCode: "COP",
      issuerVatResponsibility,
      metadata: {
        saleId: saleRow.id,
        customerId: saleRow.customer_id,
        tenantId,
        branchId: saleContext.branchId ?? null,
        terminalId: saleContext.terminalId ?? null,
        posSessionId: saleContext.posSessionId ?? null,
        orderId: saleRow.order_id ?? billingSource.orderId ?? null,
        paymentMethods: effectiveLegacyPaymentMethods,
        paymentCount: payments.length,
      },
    };

    if (enqueueEvent) {
      await this.integrationOutboxService.enqueueSaleCompletedEvent(event, client);
    }

    return event;
  }

  getElectronicBillingMode() {
    return getElectronicBillingMode();
  }

  private async requestElectronicBillingForSaleInTransaction(
    saleId: string,
    saleContext: SaleContext,
    client: PoolClient,
    recoveryEventId?: string,
  ) {
    const saleResult = await client.query<SaleDetailRow>(
      `SELECT
        s.id, s.tenant_id, s.branch_id, s.terminal_id, s.user_id,
        s.pos_session_id, s.customer_id, s.order_id, s.type, s.status,
        s.total, s.balance, s.payment_status, s.total_paid, s.balance_due,
        s.created_at, NULL::text AS customer_name
       FROM sales s
       WHERE s.id = $1 AND s.tenant_id = $2
       FOR UPDATE` ,
      [saleId, saleContext.tenantId],
    );
    const saleRow = saleResult.rows[0];
    if (!saleRow) {
      throw new NotFoundException("sale not found");
    }

    const deterministicEventId = buildSaleCompletedForElectronicBillingEventId(
      saleContext.tenantId!,
      saleId,
    );
    const [documentsResult, outboxEvents] = await Promise.all([
      client.query<{ status: string }>(
        `SELECT status FROM electronic_documents
         WHERE tenant_id = $1 AND source_type = 'SALE' AND source_id = $2
         ORDER BY created_at DESC, id DESC`,
        [saleContext.tenantId, saleId],
      ),
      this.integrationOutboxService?.findBySource(
        saleContext.tenantId!,
        "SALE",
        saleId,
        "SALE_COMPLETED_FOR_ELECTRONIC_BILLING",
        client,
      ),
    ]);
    const existingEvents = outboxEvents ?? [];
    const deterministicEvent = existingEvents.find(
      (event) => event.event_id === deterministicEventId,
    );
    const replacementEvent = existingEvents.find(
      (event) => event.event_id !== deterministicEventId && event.status === "PENDING",
    );

    const failedRecoveryEvent = recoveryEventId
      ? existingEvents.find((event) => event.event_id === recoveryEventId)
      : null;

    if (recoveryEventId) {
      if (
        !failedRecoveryEvent ||
        failedRecoveryEvent.event_type !== "SALE_COMPLETED_FOR_ELECTRONIC_BILLING" ||
        failedRecoveryEvent.status !== "FAILED" ||
        failedRecoveryEvent.attempt_count !== 1
      ) {
        throw new BadRequestException("failed pre-provider event is not recoverable");
      }

      const inboxResult = await client.query<{
        id: string;
        status: string;
        electronic_document_id: string | null;
        last_error_code: string | null;
        last_error_message: string | null;
      }>(
        `SELECT id, status, electronic_document_id, last_error_code, last_error_message
         FROM electronic_billing_inbox_events
         WHERE tenant_id = $1 AND event_id = $2 AND source_type = 'SALE' AND source_id = $3
         FOR UPDATE`,
        [saleContext.tenantId, recoveryEventId, saleId],
      );
      const inbox = inboxResult.rows[0];
      const failureText = `${failedRecoveryEvent.last_error ?? ""} ${inbox?.last_error_message ?? ""}`;
      if (
        !inbox ||
        inbox.status !== "FAILED" ||
        inbox.electronic_document_id ||
        inbox.last_error_code !== "ELECTRONIC_DOCUMENT_VALIDATION_ERROR" ||
        !failureText.includes("Sale total does not match snapshot totals")
      ) {
        throw new BadRequestException("failed event provenance is not pre-provider local-only");
      }
    }

    if (documentsResult.rows.length > 0) {
      return {
        saleId,
        result: "DOCUMENT_EXISTS",
        eligibility: "INELIGIBLE",
        requestCreated: false,
        electronicDocumentId: null,
      };
    }

    if (replacementEvent) {
      return {
        saleId,
        result: "REQUESTED",
        eligibility: "REQUESTED",
        requestCreated: false,
        electronicDocumentId: null,
        outboxEventId: replacementEvent.event_id,
      };
    }

    const stalePendingEvent =
      deterministicEvent?.status === "PENDING" && deterministicEvent.attempt_count === 0
        ? deterministicEvent
        : null;
    const eventToReplace = failedRecoveryEvent ?? stalePendingEvent;

    const eligibility = evaluateElectronicBillingEligibility({
      saleStatus: saleRow.status,
      paymentStatus: saleRow.payment_status,
      customerId: saleRow.customer_id,
      documentStatuses: [],
      requestExists: Boolean(deterministicEvent) && !stalePendingEvent && !failedRecoveryEvent,
    });
    if (eligibility !== "ELIGIBLE") {
      return {
        saleId,
        result: eligibility,
        eligibility,
        requestCreated: false,
        electronicDocumentId: null,
      };
    }
    if (!this.integrationOutboxService) {
      throw new BadRequestException("electronic billing outbox is unavailable");
    }

    const paymentResult = await client.query<{
      payment_method_id: string;
      amount: string | number;
      reference_number: string | null;
      notes: string | null;
      cash_session_id: string | null;
    }>(
      `SELECT payment.payment_method_id, allocation.allocated_amount AS amount,
              payment.reference_number, payment.notes, payment.cash_session_id
       FROM payment_allocations allocation
       INNER JOIN payments payment ON payment.id = allocation.payment_id
       WHERE allocation.reference_type = 'SALE'
         AND allocation.reference_id = $1
         AND payment.tenant_id = $2
         AND payment.status IN ('PENDING', 'COMPLETED')
       ORDER BY allocation.created_at ASC, allocation.id ASC`,
      [saleId, saleContext.tenantId],
    );
    const payments = this.normalizePayments(
      paymentResult.rows.map((row) => ({
        paymentMethodId: row.payment_method_id,
        amount: this.toNumber(row.amount),
        cashSessionId: row.cash_session_id,
        referenceNumber: row.reference_number,
        notes: row.notes,
      })),
    );
    const legacyPaymentMethods = await this.buildLegacySalePaymentMethods(
      saleContext.tenantId!,
      payments,
      client,
    );
    const replacementEventId = eventToReplace ? crypto.randomUUID() : undefined;
    if (eventToReplace) {
      const currentCustomer = await this.buildElectronicBillingCustomerSnapshot(
        saleContext.tenantId!,
        saleRow.customer_id,
        client,
      );
      if (
        !currentCustomer.taxSchemeId ||
        !currentCustomer.fiscalResponsibilityCodes ||
        currentCustomer.fiscalResponsibilityCodes.length === 0
      ) {
        throw new BadRequestException(
          "current customer fiscal tax data is incomplete for outbox recovery",
        );
      }

      if (stalePendingEvent) {
        const superseded = await this.integrationOutboxService.supersedePendingEvent(
          stalePendingEvent.event_id,
          replacementEventId!,
          new Date(),
          client,
        );
        if (!superseded) {
          throw new BadRequestException("stale outbox event changed before recovery");
        }
      }
    }
    const event = await this.enqueueSaleCompletedForElectronicBilling(
      saleContext,
      saleRow,
      null,
      legacyPaymentMethods,
      payments,
      client,
      {
        customerId: saleRow.customer_id,
        orderId: saleRow.order_id,
        eventId: replacementEventId,
      },
      Boolean(failedRecoveryEvent) ? false : true,
    );

    if (failedRecoveryEvent) {
      if (!event) {
        throw new BadRequestException("electronic billing outbox is unavailable");
      }
      const lineSubtotal = event.lines.reduce((sum, line) => sum + this.toNumber(line.subtotalAmount), 0);
      const lineTax = event.lines.reduce((sum, line) => sum + this.toNumber(line.taxAmount), 0);
      const subtotal = this.toNumber(event.totals.subtotalAmount);
      const tax = this.toNumber(event.totals.taxAmount);
      const total = this.toNumber(event.totals.totalAmount);
      if (
        Math.abs(lineSubtotal - subtotal) > 0.0001 ||
        Math.abs(lineTax - tax) > 0.0001 ||
        Math.abs(subtotal + tax - total) > 0.0001
      ) {
        throw new BadRequestException("current sale snapshot totals are inconsistent");
      }

      const recorded = await this.integrationOutboxService.recordFailedPreProviderRecovery(
        failedRecoveryEvent.event_id,
        replacementEventId!,
        failedRecoveryEvent.last_error,
        new Date(),
        client,
      );
      if (!recorded) {
        throw new BadRequestException("failed event changed before recovery");
      }
      await this.integrationOutboxService.enqueueSaleCompletedEvent(event, client);
    }
    return {
      saleId,
      result: "REQUESTED" as const,
      eligibility: "ELIGIBLE" as const,
      requestCreated: true,
      electronicDocumentId: null,
      outboxEventId: replacementEventId ?? deterministicEventId,
    };
  }

  async requestElectronicBillingForSale(saleId: string, actor: BranchScopedActor) {
    const saleContext = await this.normalizeSaleContext(actor);
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const result = await this.requestElectronicBillingForSaleInTransaction(
        saleId,
        saleContext,
        client,
      );
      await client.query("COMMIT");
      this.auditService.logEvent({
        tenantId: saleContext.tenantId,
        userId: saleContext.userId,
        module: "sales",
        entity: "sales",
        entityId: saleId,
        action: "ELECTRONIC_BILLING_REQUESTED_MANUALLY",
      });
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recoverFailedPreProviderElectronicBillingIntent(
    saleId: string,
    eventId: string,
    actor: BranchScopedActor,
  ) {
    const saleContext = await this.normalizeSaleContext(actor);
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const result = await this.requestElectronicBillingForSaleInTransaction(
        saleId,
        saleContext,
        client,
        eventId,
      );
      await client.query("COMMIT");
      this.auditService.logEvent({
        tenantId: saleContext.tenantId,
        userId: saleContext.userId,
        module: "sales",
        entity: "sales",
        entityId: saleId,
        action: "ELECTRONIC_BILLING_PRE_PROVIDER_RECOVERY_REQUESTED",
      });
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async requestElectronicBillingForSales(saleIds: string[], actor: BranchScopedActor) {
    const uniqueSaleIds = [...new Set(saleIds.filter(Boolean))];
    const results = [] as Array<Record<string, unknown>>;
    for (const saleId of uniqueSaleIds) {
      try {
        results.push(await this.requestElectronicBillingForSale(saleId, actor));
      } catch (error) {
        results.push({
          saleId,
          result: "INELIGIBLE",
          eligibility: "INELIGIBLE",
          requestCreated: false,
          reason: error instanceof Error ? error.message : "billing request failed",
        });
      }
    }
    return { selected: uniqueSaleIds.length, results };
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

  private async resolveSaleScope(
    actor: BranchScopedActor,
    filters: BranchScopedFilters
  ) {
    const requestedTenantId = normalizeOptionalFilter(filters.tenantId);
    const requestedBranchId = normalizeOptionalFilter(filters.branchId);

    if (actor.roles.includes("SUPER_ADMIN")) {
      return {
        tenantId: requestedTenantId,
        branchId: requestedBranchId,
        branchIds: undefined as string[] | undefined,
      };
    }

    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    if (requestedTenantId && requestedTenantId !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }

    const tenantId = actor.tenantId;
    const allowedBranchIds = await this.resolveAllowedBranchIds(actor, tenantId);

    if (
      requestedBranchId &&
      (allowedBranchIds?.length ?? 0) > 0 &&
      !allowedBranchIds?.includes(requestedBranchId)
    ) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }

    if (hasBranchScopedRole(actor) && actor.branchId) {
      if (requestedBranchId && requestedBranchId !== actor.branchId) {
        throw new ForbiddenException("No autorizado para otra sucursal");
      }

      return {
        tenantId,
        branchId: actor.branchId,
        branchIds: [actor.branchId],
      };
    }

    return {
      tenantId,
      branchId: requestedBranchId,
      branchIds: allowedBranchIds,
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
  ): Promise<InheritedOrderPaymentResult> {
    const orderPayments = await this.listInheritableOrderPayments(tenantId, orderId, client);
    const paymentById = new Map(
      orderPayments.map((item) => [item.payment.id, item.payment] as const)
    );
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
    const inheritedByPaymentId = new Map<
      string,
      { paymentMethodTipo: string | null; amount: number; reference: string | null }
    >();

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

      const sourcePayment = paymentById.get(allocation.payment_id);
      if (sourcePayment) {
        const current = inheritedByPaymentId.get(allocation.payment_id);
        inheritedByPaymentId.set(allocation.payment_id, {
          paymentMethodTipo: sourcePayment.payment_method_tipo,
          amount: this.roundCurrency((current?.amount ?? 0) + allocatedAmount),
          reference:
            sourcePayment.reference_number ?? sourcePayment.notes ?? current?.reference ?? null,
        });
      }

      inheritedTotal = this.roundCurrency(inheritedTotal + allocatedAmount);
      remaining = this.roundCurrency(remaining - allocatedAmount);
    }

    return {
      inheritedTotal,
      inheritedPayments: Array.from(inheritedByPaymentId.values()).filter(
        (payment) => payment.amount > 0
      ),
    };
  }

  private determineConfirmedStatus(
    total: number,
    totalPaid: number
  ): "CONFIRMED" {
    return totalPaid > 0 ? "CONFIRMED" : "CONFIRMED";
  }

  private determineCancelledStatus(
    hasRefundedPayments: boolean
  ): "CANCELLED" | "REFUNDED" {
    return hasRefundedPayments ? "REFUNDED" : "CANCELLED";
  }

  private mapLegacySalePaymentMethod(
    paymentMethodType: string | null
  ): "CASH" | "CARD" | "TRANSFER" | "OTHER" {
    switch (paymentMethodType) {
      case "CASH":
        return "CASH";
      case "CARD":
        return "CARD";
      case "BANK":
        return "TRANSFER";
      default:
        return "OTHER";
    }
  }

  private async persistSalePaymentMethods(
    tenantId: string,
    saleId: string,
    payments: CreatedPaymentSnapshot[],
    client: PoolClient
  ) {
    for (const payment of payments) {
      await this.repository.insertSalePaymentMethod(
        tenantId,
        saleId,
        {
          paymentMethod: this.mapLegacySalePaymentMethod(payment.paymentMethodTipo),
          amount: payment.amount,
          reference: payment.reference,
        },
        client
      );
    }
  }

  private async finalizeSale(
    saleId: string,
    tenantId: string,
    total: number,
    client: PoolClient
  ) {
    await this.paymentsRepository.syncSaleFinancialState(client, saleId, tenantId);
    const financialState = await client.query<{
      total_paid: string | number;
    }>(
      `
        SELECT total_paid
        FROM sales
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [saleId, tenantId]
    );
    const totalPaid = this.toNumber(financialState.rows[0]?.total_paid ?? 0);

    await this.repository.updateSaleStatus(
      saleId,
      tenantId,
      this.determineConfirmedStatus(total, totalPaid),
      client
    );
  }

  private async finalizeCancelledSale(
    saleId: string,
    tenantId: string,
    status: "CANCELLED" | "REFUNDED",
    client: PoolClient
  ) {
    await client.query(
      `
        UPDATE sales
        SET
          status = $3,
          total_paid = 0,
          balance = 0,
          balance_due = 0,
          payment_status = 'PENDING'
        WHERE id = $1
          AND tenant_id = $2
      `,
      [saleId, tenantId, status]
    );
  }

  private async productRequiresLot(
    tenantId: string,
    productId: string,
    client: PoolClient
  ) {
    const result = await client.query<ProductLotRequirementRow>(
      `
        SELECT id, requires_lot
        FROM products
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [productId, tenantId]
    );

    const product = result.rows[0];
    if (!product) {
      throw new BadRequestException("product not found for tenant");
    }

    return product.requires_lot;
  }

  private async assertCanSkipLottedReversal(
    tenantId: string,
    productId: string,
    client: PoolClient
  ) {
    const requiresLot = await this.productRequiresLot(tenantId, productId, client);
    if (requiresLot) {
      throw new BadRequestException(
        "lotted sale movement is missing stock_movement_lots for reversal"
      );
    }
  }

  private async reverseLottedStockMovement(
    tenantId: string,
    originalMovement: SaleStockMovementRow,
    reverseMovementId: string,
    client: PoolClient
  ) {
    const lotLinksResult = await client.query<SaleStockMovementLotRow>(
      `
        SELECT
          sml.id,
          sml.product_id,
          sml.lot_id,
          sml.location_id,
          sml.quantity
        FROM stock_movement_lots AS sml
        WHERE sml.tenant_id = $1
          AND sml.stock_movement_id = $2
        ORDER BY sml.created_at ASC, sml.id ASC
      `,
      [tenantId, originalMovement.id]
    );

    if (lotLinksResult.rows.length === 0) {
      await this.assertCanSkipLottedReversal(
        tenantId,
        originalMovement.product_id,
        client
      );
      return;
    }

    if (!originalMovement.branch_id) {
      throw new BadRequestException(
        "lotted sale movement is missing branch for reversal"
      );
    }

    const movementQuantity = this.toNumber(originalMovement.quantity);
    const linkedQuantity = lotLinksResult.rows.reduce(
      (sum, link) => sum + this.toNumber(link.quantity),
      0
    );

    if (Math.abs(linkedQuantity - movementQuantity) > 0.0001) {
      throw new BadRequestException(
        "lotted sale movement link quantity does not match stock movement"
      );
    }

    for (const link of lotLinksResult.rows) {
      const quantity = this.toNumber(link.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException("stock_movement_lots quantity is invalid");
      }
      if (!link.lot_id) {
        throw new BadRequestException("stock_movement_lots lot is invalid");
      }

      const lotResult = await client.query<SaleLotRow>(
        `
          SELECT id, status, branch_id, product_id
          FROM inventory_lots
          WHERE tenant_id = $1
            AND id = $2
          LIMIT 1
          FOR UPDATE
        `,
        [tenantId, link.lot_id]
      );
      const lot = lotResult.rows[0];

      if (!lot) {
        throw new BadRequestException("stock_movement_lots lot is invalid");
      }
      if (lot.status === "CANCELLED") {
        throw new BadRequestException(
          "CANCELLED lot cannot be reversed automatically"
        );
      }
      if (lot.branch_id !== originalMovement.branch_id) {
        throw new BadRequestException("stock_movement_lots lot branch mismatch");
      }
      if (
        link.product_id !== originalMovement.product_id ||
        lot.product_id !== originalMovement.product_id
      ) {
        throw new BadRequestException("stock_movement_lots product mismatch");
      }

      const balanceResult = await client.query<{ id: string }>(
        `
          UPDATE inventory_lot_balances AS balance
          SET
            quantity_on_hand = balance.quantity_on_hand + $5,
            last_movement_at = NOW(),
            updated_at = NOW()
          WHERE balance.tenant_id = $1
            AND balance.branch_id = $2
            AND balance.product_id = $3
            AND balance.lot_id = $4
            AND (
              ($6::uuid IS NULL AND balance.location_id IS NULL)
              OR balance.location_id = $6::uuid
            )
          RETURNING balance.id
        `,
        [
          tenantId,
          originalMovement.branch_id,
          originalMovement.product_id,
          link.lot_id,
          quantity,
          link.location_id,
        ]
      );

      if (!balanceResult.rows[0]) {
        throw new BadRequestException(
          "inventory lot balance not found for reversal"
        );
      }

      await client.query(
        `
          INSERT INTO stock_movement_lots (
            id,
            tenant_id,
            stock_movement_id,
            product_id,
            lot_id,
            location_id,
            quantity,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, NOW()
          )
        `,
        [
          crypto.randomUUID(),
          tenantId,
          reverseMovementId,
          originalMovement.product_id,
          link.lot_id,
          link.location_id,
          quantity,
        ]
      );
    }
  }

  private async validateInvoiceableOrder(
    tenantId: string,
    orderId: string,
    client: PoolClient
  ) {
    const orderResult = await client.query<InvoiceableOrderRow>(
      `
        SELECT id, customer_id, type
        FROM orders
        WHERE id = $1
          AND tenant_id = $2
          AND status IN ('PARTIAL', 'COMPLETED')
        LIMIT 1
      `,
      [orderId, tenantId]
    );
    const order = orderResult.rows[0];
    if (!order) {
      throw new BadRequestException("order not found or not ready for invoicing");
    }

    const validCustomer = await this.repository.validateCustomer(
      tenantId,
      order.customer_id,
      client
    );
    if (!validCustomer) {
      throw new BadRequestException("customer not found for tenant");
    }

    return order;
  }

  private async getInvoiceableOrderItems(orderId: string, client: PoolClient) {
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
      [orderId]
    );
    if (itemsResult.rows.length === 0) {
      throw new BadRequestException("order has no delivered items pending invoicing");
    }

    return itemsResult.rows;
  }

  private async linkOrderDeliveryToSale(
    tenantId: string,
    orderId: string | null | undefined,
    saleId: string,
    userId: string | undefined,
    client: PoolClient
  ) {
    if (!orderId) {
      return null;
    }

    const existingSaleDelivery = await client.query<{ id: string }>(
      `
        SELECT id
        FROM public.deliveries
        WHERE tenant_id = $1::uuid
          AND sale_id = $2::uuid
        LIMIT 1
      `,
      [tenantId, saleId]
    );
    if (existingSaleDelivery.rows[0]) {
      return existingSaleDelivery.rows[0].id;
    }

    const result = await client.query<{ id: string }>(
      `
        UPDATE public.deliveries
        SET sale_id = $3::uuid,
            updated_by_user_id = COALESCE($4::uuid, updated_by_user_id),
            updated_at = now(),
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'source_sale_id', ($3::uuid)::text,
              'sale_link_source', 'order_sale_creation'
            )
        WHERE tenant_id = $1::uuid
          AND order_id = $2::uuid
          AND sale_id IS NULL
        RETURNING id
      `,
      [tenantId, orderId, saleId, userId ?? null]
    );

    return result.rows[0]?.id ?? null;
  }

  private async createSaleItemsFromOrderDelivery(
    saleId: string,
    tenantId: string,
    orderItems: InvoiceableOrderItemRow[],
    client: PoolClient
  ) {
    let total = 0;

    for (const item of orderItems) {
      const quantity = this.roundCurrency(
        this.toNumber(item.delivered_quantity) - this.toNumber(item.billed_quantity)
      );
      if (quantity <= 0) {
        continue;
      }

      const price = this.roundCurrency(this.toNumber(item.price));
      const product = await this.repository.getProductForSale(
        tenantId,
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
        saleId,
        tenantId,
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
          tenantId,
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

    return total;
  }

  private async createSalePayments(
    saleId: string,
    saleContext: Awaited<ReturnType<SaleService["normalizeSaleContext"]>>,
    payments: ReturnType<SaleService["normalizePayments"]>,
    inheritedPayments: CreatedPaymentSnapshot[],
    client: PoolClient
  ) {
    const createdPayments: CreatedPaymentSnapshot[] = [...inheritedPayments];

    for (const payment of payments) {
      const payload = Object.assign(new CreatePaymentDto(), {
        branchId: saleContext.branchId,
        paymentMethodId: payment.paymentMethodId,
        cashSessionId: payment.cashSessionId,
        referenceType: "SALE",
        referenceId: saleId,
        direction: "IN",
        status: "COMPLETED",
        amount: payment.amount,
        referenceNumber: payment.referenceNumber,
        notes: payment.notes,
      });

      const createdPayment = await this.paymentsService.createInTransaction(
        payload,
        this.buildFinanceActor(saleContext),
        client
      );

      createdPayments.push({
        paymentMethodTipo: createdPayment.paymentMethodTipo,
        amount: createdPayment.amount,
        reference: createdPayment.referenceNumber ?? createdPayment.notes ?? null,
      });
    }

    return createdPayments;
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

      const payments = this.normalizePayments(data.payments);
      const pricingCalculatedAt = new Date();
      const pricedItems = await this.calculatePricedPosItems({
        tenantId: saleContext.tenantId,
        branchId: saleContext.branchId,
        customerId: data.customerId,
        items: data.items,
        pricingCalculatedAt,
      });
      const backendTotal = this.calculateBackendSaleTotal(pricedItems);
      this.ensureCashPaymentsMatchBackendTotal(data.type, payments, backendTotal);

      const legacyPaymentMethods = await this.buildLegacySalePaymentMethods(
        saleContext.tenantId,
        payments,
        client
      );

      const saleRow = await this.repository.createSaleWithFunction(
        {
          ...data,
          items: pricedItems,
          ...saleContext,
        },
        legacyPaymentMethods,
        client
      );
      if (!saleRow) {
        throw new BadRequestException("sale could not be created");
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

        const createdPayment = await this.paymentsService.createInTransaction(
          payload,
          this.buildFinanceActor(saleContext),
          client
        );
      }

      await this.finalizeSale(
        saleRow.id,
        saleContext.tenantId,
        this.toNumber(saleRow.total),
        client
      );
      await this.linkOrderDeliveryToSale(
        saleContext.tenantId,
        saleRow.order_id ?? data.orderId ?? null,
        saleRow.id,
        saleContext.userId,
        client
      );
      if (getElectronicBillingMode() === "AUTOMATIC") {
        await this.enqueueSaleCompletedForElectronicBilling(
          saleContext,
          saleRow,
          pricedItems as PricedSaleItem[],
          legacyPaymentMethods,
          payments,
          client,
          {
            customerId: data.customerId,
            orderId: data.orderId ?? saleRow.order_id ?? null,
          }
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

      await this.validateInvoiceableOrder(saleContext.tenantId, data.orderId, client);
      const payments = this.normalizePayments(data.payments);

      const saleRow = await this.repository.invoiceOrderWithFunction(
        {
          ...saleContext,
          orderId: data.orderId,
          type: data.type,
          payments,
        },
        client
      );
      if (!saleRow) {
        throw new BadRequestException("sale could not be created");
      }
      await this.linkOrderDeliveryToSale(
        saleContext.tenantId,
        saleRow.order_id ?? data.orderId,
        saleRow.id,
        saleContext.userId,
        client
      );
      if (getElectronicBillingMode() === "AUTOMATIC") {
        await this.enqueueSaleCompletedForElectronicBilling(
          saleContext,
          saleRow,
          null,
          null,
          payments,
          client,
          {
            customerId: saleRow.customer_id,
            orderId: data.orderId ?? saleRow.order_id ?? null,
          }
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
  async getSales(actor: BranchScopedActor, filters: BranchScopedFilters = {}) {
    const scope = await this.resolveSaleScope(actor, {
      tenantId: actor.tenantId,
      branchId: filters.branchId ?? actor.branchId,
    });
    const params: unknown[] = [scope.tenantId];
    const where = [`s.tenant_id = $1`];
    const customerId = normalizeOptionalFilter(filters.customerId);

    if (scope.branchId) {
      params.push(scope.branchId);
      where.push(`s.branch_id = $${params.length}`);
    } else if ((scope.branchIds?.length ?? 0) > 0) {
      params.push(scope.branchIds);
      where.push(`s.branch_id = ANY($${params.length}::uuid[])`);
    }

    if (customerId) {
      params.push(customerId);
      where.push(`s.customer_id = $${params.length}::uuid`);
    }

    const result = (await this.db.query(
      `
        SELECT
          s.id,
          s.tenant_id,
          s.branch_id,
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
        WHERE ${where.join("\n          AND ")}
        ORDER BY s.created_at DESC, s.id DESC
      `,
      params
    )) as { rows: SaleListRow[] };

    return result.rows.map((row) => this.mapSaleSummary(row));
  }

  async getSaleById(id: string, actorOrTenantId: BranchScopedActor | string) {
    const tenantId =
      typeof actorOrTenantId === "string" ? actorOrTenantId : actorOrTenantId.tenantId;
    if (!tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }

    const saleResult = (await this.db.query(
      `
        SELECT
          s.id,
          s.tenant_id,
          s.branch_id,
          s.terminal_id,
          s.user_id,
          s.pos_session_id,
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

    if (typeof actorOrTenantId !== "string") {
      await this.resolveSaleScope(actorOrTenantId, {
        tenantId,
        branchId: saleRow.branch_id,
      });
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
            line_total,
            pricing_source,
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

  async cancelSale(id: string, actor: BranchScopedActor) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query<SaleDetailRow>(
        `
          SELECT
            s.id,
            s.tenant_id,
            s.branch_id,
            s.terminal_id,
            s.user_id,
            s.pos_session_id,
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
          FOR UPDATE OF s
        `,
        [id, actor.tenantId]
      );

      const sale = saleResult.rows[0];
      if (!sale) {
        throw new NotFoundException("sale not found");
      }

      await this.resolveSaleScope(actor, {
        tenantId: sale.tenant_id,
        branchId: sale.branch_id,
      });

      if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
        await client.query("COMMIT");
        return this.mapSale(sale);
      }

      if (sale.status !== "DRAFT" && sale.status !== "CONFIRMED") {
        throw new BadRequestException("sale cannot be cancelled in its current status");
      }

      const saleItemsResult = await client.query<SaleItemRow>(
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
        [id, sale.tenant_id]
      );

      const stockMovementsResult = await client.query<SaleStockMovementRow>(
        `
          SELECT
            id,
            product_id,
            quantity,
            branch_id,
            terminal_id,
            pos_session_code,
            user_id
          FROM stock_movements
          WHERE tenant_id = $1
            AND reference_type = 'SALE'
            AND reference_id = $2
            AND reference_table = 'sales'
            AND type = 'OUT'
          ORDER BY created_at ASC, id ASC
        `,
        [sale.tenant_id, id]
      );

      const movementByProduct = new Map<string, SaleStockMovementRow[]>();
      for (const movement of stockMovementsResult.rows) {
        const current = movementByProduct.get(movement.product_id) ?? [];
        current.push(movement);
        movementByProduct.set(movement.product_id, current);
      }

      for (const item of saleItemsResult.rows) {
        const originalMovements = movementByProduct.get(item.product_id) ?? [];
        const originalMovement = originalMovements.shift();

        if (originalMovement) {
          const reverseMovement = await this.stockMovementService.createMovement(
            {
              id: crypto.randomUUID(),
              tenantId: sale.tenant_id,
              productId: item.product_id,
              type: "IN",
              quantity: this.toNumber(originalMovement.quantity),
              referenceType: "SALE",
              referenceId: id,
              branchId: originalMovement.branch_id,
              terminalId: originalMovement.terminal_id,
              posSessionCode: originalMovement.pos_session_code,
              userId: actor.userId ?? sale.user_id ?? null,
              referenceTable: "sales",
              createdAt: new Date(),
            },
            client
          );

          await this.reverseLottedStockMovement(
            sale.tenant_id,
            originalMovement,
            reverseMovement.id,
            client
          );
        } else {
          await this.assertCanSkipLottedReversal(
            sale.tenant_id,
            item.product_id,
            client
          );
        }

        if (sale.order_id && item.order_item_id) {
          await client.query(
            `
              UPDATE order_items
              SET
                billed_quantity = GREATEST(COALESCE(billed_quantity, 0) - $2, 0),
                delivered_quantity = CASE
                  WHEN $3 THEN GREATEST(delivered_quantity - $2, 0)
                  ELSE delivered_quantity
                END
              WHERE id = $1
            `,
            [item.order_item_id, this.toNumber(item.quantity), Boolean(originalMovement)]
          );
        }
      }

      const allocatedPayments = await this.paymentsRepository.listAllocatedPayments(
        sale.tenant_id,
        "SALE",
        id,
        client
      );

      let hasRefundedPayments = false;

      for (const payment of allocatedPayments) {
        const paymentAllocations = await this.paymentsRepository.listAllocationsByPaymentIds(
          [payment.id],
          client
        );
        const saleAllocations = paymentAllocations.filter(
          (allocation) =>
            allocation.reference_type === "SALE" && allocation.reference_id === id
        );
        const refundedAmount = saleAllocations.reduce(
          (sum, allocation) => sum + this.toNumber(allocation.allocated_amount),
          0
        );

        if (sale.order_id && payment.reference_type === "SALES_ORDER") {
          for (const allocation of saleAllocations) {
            await this.paymentsRepository.updateAllocation(client, allocation.id, {
              referenceType: "SALES_ORDER",
              referenceId: sale.order_id,
            });
          }
          await this.paymentsRepository.syncOrderFinancialState(
            client,
            sale.order_id,
            sale.tenant_id
          );
          continue;
        }

        if (refundedAmount > 0 && (payment.status === "COMPLETED" || payment.status === "PENDING")) {
          if (payment.status === "COMPLETED") {
            hasRefundedPayments = true;
            const refundPayment = await this.paymentsRepository.createPayment(client, {
              tenantId: sale.tenant_id,
              branchId: payment.branch_id,
              paymentMethodId: payment.payment_method_id,
              cashSessionId: payment.cash_session_id,
              referenceType: "REFUND",
              referenceId: id,
              direction: "OUT",
              status: "COMPLETED",
              amount: refundedAmount,
              referenceNumber: payment.reference_number,
              notes: `Refund for cancelled sale ${id}`,
              createdBy: actor.userId ?? sale.user_id ?? payment.created_by,
            });

            if (!refundPayment) {
              throw new BadRequestException("refund payment could not be created");
            }

            await this.paymentsRepository.createAllocations(client, refundPayment.id, [
              {
                referenceType: "SALE",
                referenceId: id,
                allocatedAmount: refundedAmount,
              },
            ]);

            if (payment.cash_session_id) {
              await this.paymentsRepository.createCashRefundMovement(client, {
                tenantId: sale.tenant_id,
                branchId: payment.branch_id,
                cashSessionId: payment.cash_session_id,
                paymentId: refundPayment.id,
                amount: refundedAmount,
                createdBy: actor.userId ?? sale.user_id ?? payment.created_by,
                referenceId: id,
                description: `Refund sale ${id} from payment ${payment.id}`,
              });
            }
          }
        }

        for (const allocation of saleAllocations) {
          await this.paymentsRepository.deleteAllocation(client, allocation.id);
        }

        const remainingAllocations = paymentAllocations.filter(
          (allocation) => !saleAllocations.some((saleAllocation) => saleAllocation.id === allocation.id)
        );
        const paymentAmount = this.toNumber(payment.amount);

        if (payment.status === "PENDING" && remainingAllocations.length === 0) {
          await this.paymentsRepository.updatePaymentStatus(client, payment.id, "CANCELLED");
        } else if (
          payment.status === "COMPLETED" &&
          remainingAllocations.length === 0 &&
          refundedAmount >= paymentAmount
        ) {
          await this.paymentsRepository.updatePaymentStatus(client, payment.id, "REFUNDED");
        }
      }

      if (sale.order_id) {
        await this.repository.refreshOrderStatus(sale.order_id, sale.tenant_id, client);
      }

      const nextStatus = this.determineCancelledStatus(hasRefundedPayments);
      await this.finalizeCancelledSale(id, sale.tenant_id, nextStatus, client);

      await client.query("COMMIT");
      return this.getSaleById(id, sale.tenant_id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
