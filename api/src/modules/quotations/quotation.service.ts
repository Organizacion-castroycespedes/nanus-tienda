import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import { AuditService } from "../../common/services/audit.service";
import { FinanceAccessRepository } from "../finance/common/repositories/finance-access.repository";
import { OrderService } from "../inventory/services/order.service";
import type { InventoryContext } from "../inventory/services/stock-movement.service";
import {
  canViewAllBranches,
  hasBranchScopedRole,
  normalizeOptionalFilter,
  type BranchScopedActor,
} from "../inventory/utils/access";
import { getQuantityPolicyViolation } from "../inventory/utils/quantity-policy";
import { PricingService } from "../pricing/pricing.service";
import type { LinePricePreview } from "../pricing/pricing.types";
import {
  QUOTATION_EFFECTIVE_STATUSES,
  addDays,
  assertCanApprove,
  assertCanConvert,
  assertCanEdit,
  assertCanReject,
  assertCanRenew,
  assertCanSend,
  assertValidityDays,
  resolveEffectiveStatus,
  toDateOnly,
  todayInBogota,
  type QuotationEffectiveStatus,
} from "./quotation.policy";
import {
  QuotationMailer,
  QuotationPdfClient,
  buildQuotationEmail,
  isValidEmail,
  quotationPdfFileName,
  sanitizeMailError,
} from "./quotation-mail";
import {
  QuotationRepository,
  type QuotationHeaderValues,
  type QuotationItemRow,
  type QuotationItemValues,
  type QuotationRow,
} from "./quotation.repository";

export type QuotationLineInput = {
  productId: string;
  quantity: number;
};

export type QuotationInput = {
  customerId: string;
  branchId?: string;
  items: QuotationLineInput[];
  commercialTerms?: string | null;
  paymentDeliveryTerms?: string | null;
  warrantyTerms?: string | null;
  notes?: string | null;
};

export type QuotationListQuery = {
  branchId?: string;
  customerId?: string;
  status?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
};

export type QuotationActor = BranchScopedActor;

const MAX_LINES = 500;
const MAX_TEXT_LENGTH = 5000;

const round2 = (value: number) => Math.round((value + 1e-9) * 100) / 100;
const toNumber = (value: string | number | null | undefined) => Number(value ?? 0);
const toIso = (value: string | Date | null | undefined) =>
  value === null || value === undefined ? null : new Date(value).toISOString();

const normalizeText = (value: unknown, field: string) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} debe ser texto.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new BadRequestException(`${field} supera ${MAX_TEXT_LENGTH} caracteres.`);
  }
  return trimmed.length > 0 ? trimmed : null;
};

type PricedQuotation = {
  items: QuotationItemValues[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  pricingCalculatedAt: Date;
};

@Injectable()
export class QuotationService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(QuotationRepository) private readonly repository: QuotationRepository,
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(OrderService) private readonly orderService: OrderService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(FinanceAccessRepository)
    private readonly financeAccessRepository: FinanceAccessRepository,
    @Inject(QuotationMailer) private readonly mailer: QuotationMailer,
    @Inject(QuotationPdfClient) private readonly pdfClient: QuotationPdfClient
  ) {}

  /** Reloj inyectable en pruebas. */
  clock: () => Date = () => new Date();

  // ---------------------------------------------------------------- alcance

  private requireTenant(actor: QuotationActor) {
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    return actor.tenantId;
  }

  /** Sucursales visibles para el actor; `undefined` = todas las del tenant. */
  private async resolveBranchIds(actor: QuotationActor, tenantId: string) {
    if (canViewAllBranches(actor)) {
      return undefined;
    }
    if (hasBranchScopedRole(actor) && actor.branchId) {
      return [actor.branchId];
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

  private async assertBranchAllowed(actor: QuotationActor, tenantId: string, branchId: string) {
    const branchIds = await this.resolveBranchIds(actor, tenantId);
    if (branchIds && !branchIds.includes(branchId)) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }
  }

  private async resolveTargetBranch(
    actor: QuotationActor,
    tenantId: string,
    requested: string | undefined
  ) {
    const branchId = normalizeOptionalFilter(requested) ?? actor.branchId;
    if (!branchId) {
      throw new BadRequestException("La sucursal es obligatoria.");
    }
    await this.assertBranchAllowed(actor, tenantId, branchId);
    return branchId;
  }

  // ------------------------------------------------------------ valorizacion

  private validateLines(items: unknown): QuotationLineInput[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException("La cotizacion debe tener al menos un producto.");
    }
    if (items.length > MAX_LINES) {
      throw new BadRequestException(`La cotizacion admite maximo ${MAX_LINES} lineas.`);
    }
    return items.map((raw, index) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      const productId = typeof item.productId === "string" ? item.productId.trim() : "";
      if (!productId) {
        throw new BadRequestException(`La linea ${index + 1} debe tener un producto del catalogo.`);
      }
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(`La linea ${index + 1} debe tener una cantidad mayor que cero.`);
      }
      return { productId, quantity };
    });
  }

  private async priceLines(
    client: PoolClient,
    input: {
      quotationId: string;
      tenantId: string;
      branchId: string;
      customerId: string;
      lines: QuotationLineInput[];
    }
  ): Promise<PricedQuotation> {
    const products = await this.repository.findProducts(
      client,
      input.tenantId,
      Array.from(new Set(input.lines.map((line) => line.productId)))
    );
    const pricingCalculatedAt = this.clock();
    const items: QuotationItemValues[] = [];

    for (const [index, line] of input.lines.entries()) {
      const product = products.get(line.productId);
      if (!product || !product.is_active) {
        throw new BadRequestException(
          `El producto de la linea ${index + 1} no existe o esta inactivo.`
        );
      }
      const violation = getQuantityPolicyViolation(
        line.quantity,
        { saleType: product.sale_type, allowsDecimalQuantity: product.allows_decimal_quantity },
        product.name
      );
      if (violation) {
        throw new BadRequestException(violation);
      }
      const preview: LinePricePreview = await this.pricingService.calculateLinePrice({
        tenantId: input.tenantId,
        branchId: input.branchId,
        customerId: input.customerId,
        productId: line.productId,
        quantity: line.quantity,
        channel: "ORDER",
        date: pricingCalculatedAt.toISOString(),
      });
      items.push({
        lineNumber: index + 1,
        productId: line.productId,
        productName: product.name,
        productCode: product.sku,
        unitCode: product.measurement_unit,
        quantity: preview.quantity,
        baseUnitPrice: preview.baseUnitPrice,
        finalUnitPrice: preview.finalUnitPrice,
        discountAmount: preview.discountAmount,
        discountPercent: preview.discountPercent,
        discountTotal: round2(preview.discountAmount * preview.quantity),
        appliedPromotionId: preview.appliedPromotionId,
        appliedPromotionName: preview.appliedPromotionName,
        taxId: preview.taxId,
        taxRate: preview.taxRate,
        taxBase: preview.taxBase,
        taxAmount: preview.taxAmount,
        lineTotal: preview.lineTotal,
        // Misma forma que order_items.pricing_snapshot (result.taxes) para replicar impuestos al convertir.
        pricingSnapshot: {
          channel: "QUOTATION",
          pricingChannel: "ORDER",
          quotationId: input.quotationId,
          tenantId: input.tenantId,
          branchId: input.branchId,
          customerId: input.customerId,
          calculatedAt: pricingCalculatedAt.toISOString(),
          productId: preview.productId,
          quantity: preview.quantity,
          taxes: preview.taxes,
          result: preview,
        },
      });
    }

    return {
      items,
      subtotal: round2(items.reduce((sum, item) => sum + item.taxBase, 0)),
      discountTotal: round2(items.reduce((sum, item) => sum + item.discountTotal, 0)),
      taxTotal: round2(items.reduce((sum, item) => sum + item.taxAmount, 0)),
      total: round2(items.reduce((sum, item) => sum + item.lineTotal, 0)),
      pricingCalculatedAt,
    };
  }

  private async assertCustomer(client: PoolClient, tenantId: string, customerId: unknown) {
    if (typeof customerId !== "string" || customerId.trim().length === 0) {
      throw new BadRequestException("El cliente es obligatorio.");
    }
    const customer = await this.repository.findCustomer(client, tenantId, customerId.trim());
    if (!customer) {
      throw new BadRequestException("El cliente no existe en este tenant.");
    }
    if (!customer.is_active) {
      throw new BadRequestException("El cliente esta inactivo.");
    }
    return customer.id;
  }

  // ----------------------------------------------------------------- mapeo

  private mapItem(row: QuotationItemRow) {
    const snapshot =
      typeof row.pricing_snapshot === "string"
        ? (JSON.parse(row.pricing_snapshot) as Record<string, unknown>)
        : row.pricing_snapshot;
    return {
      id: row.id,
      lineNumber: Number(row.line_number),
      productId: row.product_id,
      productName: row.product_name,
      productCode: row.product_code,
      unitCode: row.unit_code,
      quantity: toNumber(row.quantity),
      baseUnitPrice: toNumber(row.base_unit_price),
      finalUnitPrice: toNumber(row.final_unit_price),
      discountAmount: toNumber(row.discount_amount),
      discountPercent: toNumber(row.discount_percent),
      discountTotal: toNumber(row.discount_total),
      appliedPromotionId: row.applied_promotion_id,
      appliedPromotionName: row.applied_promotion_name,
      taxId: row.tax_id,
      taxRate: toNumber(row.tax_rate),
      taxBase: toNumber(row.tax_base),
      taxAmount: toNumber(row.tax_amount),
      lineTotal: toNumber(row.line_total),
      pricingSnapshot: snapshot,
    };
  }

  /** IVA y demas impuestos agrupados por nombre y tarifa (desde el snapshot de cada linea). */
  private summarizeTaxes(items: ReturnType<QuotationService["mapItem"]>[]) {
    const groups = new Map<string, { taxName: string; taxRate: number; taxBase: number; taxAmount: number }>();
    for (const item of items) {
      const taxes = Array.isArray(item.pricingSnapshot?.taxes)
        ? (item.pricingSnapshot.taxes as Array<Record<string, unknown>>)
        : [];
      const effective =
        taxes.length > 0
          ? taxes.map((tax) => ({
              taxName: String(tax.taxName ?? "Impuesto"),
              taxRate: Number(tax.taxRate ?? 0),
              taxBase: Number(tax.taxBase ?? 0),
              taxAmount: Number(tax.taxAmount ?? 0),
            }))
          : item.taxAmount > 0
            ? [{ taxName: "IVA", taxRate: item.taxRate, taxBase: item.taxBase, taxAmount: item.taxAmount }]
            : [];
      for (const tax of effective) {
        const key = `${tax.taxName}|${tax.taxRate}`;
        const group = groups.get(key) ?? { taxName: tax.taxName, taxRate: tax.taxRate, taxBase: 0, taxAmount: 0 };
        group.taxBase = round2(group.taxBase + tax.taxBase);
        group.taxAmount = round2(group.taxAmount + tax.taxAmount);
        groups.set(key, group);
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.taxRate - a.taxRate);
  }

  private mapHeader(row: QuotationRow, today: string) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      status: row.status,
      effectiveStatus: resolveEffectiveStatus(row.status, row.valid_until, today),
      branchId: row.branch_id,
      branchName: row.branch_name,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerDocument: row.customer_document,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      customerAddress: row.customer_address,
      issueDate: toDateOnly(row.issue_date),
      validityDays: Number(row.validity_days),
      validUntil: toDateOnly(row.valid_until),
      subtotal: toNumber(row.subtotal),
      discountTotal: toNumber(row.discount_total),
      taxTotal: toNumber(row.tax_total),
      total: toNumber(row.total),
      commercialTerms: row.commercial_terms,
      paymentDeliveryTerms: row.payment_delivery_terms,
      warrantyTerms: row.warranty_terms,
      notes: row.notes,
      pricingCalculatedAt: toIso(row.pricing_calculated_at),
      sentAt: toIso(row.sent_at),
      approvedAt: toIso(row.approved_at),
      rejectedAt: toIso(row.rejected_at),
      rejectionReason: row.rejection_reason,
      convertedOrderId: row.converted_order_id,
      convertedAt: toIso(row.converted_at),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  private async loadForActor(
    actor: QuotationActor,
    id: string,
    options: { client?: PoolClient; forUpdate?: boolean } = {}
  ) {
    const tenantId = this.requireTenant(actor);
    const row = await this.repository.findById(tenantId, id, options);
    if (!row) {
      throw new NotFoundException("Cotizacion no encontrada");
    }
    await this.assertBranchAllowed(actor, tenantId, row.branch_id);
    return { tenantId, row };
  }

  private audit(
    tenantId: string,
    userId: string | null | undefined,
    quotationId: string,
    action: string,
    after: Record<string, unknown>
  ) {
    this.auditService.logEvent({
      tenantId,
      userId: userId ?? null,
      module: "quotations",
      entity: "quotations",
      entityId: quotationId,
      action,
      after,
    });
  }

  private async inTransaction<T>(work: (client: PoolClient) => Promise<T>) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ------------------------------------------------------------- consultas

  async list(query: QuotationListQuery, actor: QuotationActor) {
    const tenantId = this.requireTenant(actor);
    const branchIds = await this.resolveBranchIds(actor, tenantId);
    const branchId = normalizeOptionalFilter(query.branchId);
    if (branchId && branchIds && !branchIds.includes(branchId)) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }
    const status = normalizeOptionalFilter(query.status)?.toUpperCase();
    if (status && !QUOTATION_EFFECTIVE_STATUSES.includes(status as QuotationEffectiveStatus)) {
      throw new BadRequestException("Estado invalido");
    }
    const page = Math.max(1, Math.trunc(Number(query.page ?? 1)) || 1);
    const limit = Math.min(100, Math.max(1, Math.trunc(Number(query.limit ?? 20)) || 20));
    const result = await this.repository.list({
      tenantId,
      branchIds,
      branchId,
      customerId: normalizeOptionalFilter(query.customerId),
      status,
      search: normalizeOptionalFilter(query.search),
      fromDate: query.fromDate ? toDateOnly(query.fromDate) : undefined,
      toDate: query.toDate ? toDateOnly(query.toDate) : undefined,
      limit,
      offset: (page - 1) * limit,
    });
    const today = todayInBogota(this.clock());
    return {
      data: result.rows.map((row) => this.mapHeader(row, today)),
      meta: {
        page,
        limit,
        total: result.total,
        lastPage: Math.max(1, Math.ceil(result.total / limit)),
      },
      summary: {
        total: result.total,
        approved: result.approved,
        expired: result.expired,
        amount: result.amount,
      },
    };
  }

  async getById(id: string, actor: QuotationActor) {
    const { tenantId, row } = await this.loadForActor(actor, id);
    const items = (await this.repository.findItems(tenantId, id)).map((item) => this.mapItem(item));
    const order = row.converted_order_id
      ? await this.repository.findConvertedOrder(tenantId, row.converted_order_id)
      : null;
    return {
      ...this.mapHeader(row, todayInBogota(this.clock())),
      items,
      taxSummary: this.summarizeTaxes(items),
      order: order
        ? {
            id: order.id,
            status: order.status,
            total: toNumber(order.total),
            createdAt: toIso(order.created_at),
          }
        : null,
    };
  }

  // ------------------------------------------------------------ escrituras

  private async buildHeader(
    client: PoolClient,
    tenantId: string,
    quotationId: string,
    branchId: string,
    input: QuotationInput,
    dates: { issueDate: string; validityDays: number },
    userId: string | null
  ): Promise<{ header: QuotationHeaderValues; priced: PricedQuotation }> {
    const customerId = await this.assertCustomer(client, tenantId, input.customerId);
    if (!(await this.repository.branchExists(client, tenantId, branchId))) {
      throw new BadRequestException("La sucursal no existe en este tenant.");
    }
    const lines = this.validateLines(input.items);
    const priced = await this.priceLines(client, {
      quotationId,
      tenantId,
      branchId,
      customerId,
      lines,
    });
    return {
      priced,
      header: {
        branchId,
        customerId,
        issueDate: dates.issueDate,
        validityDays: dates.validityDays,
        validUntil: addDays(dates.issueDate, dates.validityDays),
        subtotal: priced.subtotal,
        discountTotal: priced.discountTotal,
        taxTotal: priced.taxTotal,
        total: priced.total,
        commercialTerms: normalizeText(input.commercialTerms, "Condiciones comerciales"),
        paymentDeliveryTerms: normalizeText(input.paymentDeliveryTerms, "Forma de pago y entrega"),
        warrantyTerms: normalizeText(input.warrantyTerms, "Garantia"),
        notes: normalizeText(input.notes, "Observaciones"),
        pricingCalculatedAt: priced.pricingCalculatedAt,
        userId,
      },
    };
  }

  async create(input: QuotationInput, actor: QuotationActor) {
    const tenantId = this.requireTenant(actor);
    const branchId = await this.resolveTargetBranch(actor, tenantId, input?.branchId);
    const quotationId = crypto.randomUUID();
    const userId = actor.userId ?? null;

    const code = await this.inTransaction(async (client) => {
      const validityDays = await this.repository.getValidityDays(tenantId, client);
      const { header, priced } = await this.buildHeader(
        client,
        tenantId,
        quotationId,
        branchId,
        input ?? ({} as QuotationInput),
        { issueDate: todayInBogota(this.clock()), validityDays },
        userId
      );
      const nextCode = await this.repository.nextCode(client, tenantId);
      await this.repository.insertQuotation(client, { id: quotationId, tenantId, code: nextCode, ...header });
      await this.repository.replaceItems(client, tenantId, quotationId, priced.items);
      return nextCode;
    });

    this.audit(tenantId, userId, quotationId, "QUOTATION_CREATED", { code, branchId });
    return this.getById(quotationId, actor);
  }

  async update(id: string, input: QuotationInput, actor: QuotationActor) {
    const userId = actor.userId ?? null;
    const tenantId = await this.inTransaction(async (client) => {
      const { tenantId: resolvedTenant, row } = await this.loadForActor(actor, id, {
        client,
        forUpdate: true,
      });
      const today = todayInBogota(this.clock());
      assertCanEdit({ status: row.status, validUntil: row.valid_until }, today);
      const branchId = input?.branchId
        ? await this.resolveTargetBranch(actor, resolvedTenant, input.branchId)
        : row.branch_id;
      const { header, priced } = await this.buildHeader(
        client,
        resolvedTenant,
        id,
        branchId,
        input ?? ({} as QuotationInput),
        { issueDate: toDateOnly(row.issue_date), validityDays: Number(row.validity_days) },
        userId
      );
      await this.repository.updateQuotation(client, { id, tenantId: resolvedTenant, ...header });
      await this.repository.replaceItems(client, resolvedTenant, id, priced.items);
      return resolvedTenant;
    });
    this.audit(tenantId, userId, id, "QUOTATION_UPDATED", {});
    return this.getById(id, actor);
  }

  async send(id: string, actor: QuotationActor) {
    return this.transition(id, actor, "QUOTATION_SENT", async (client, tenantId, row, today) => {
      assertCanSend({ status: row.status, validUntil: row.valid_until }, today);
      await this.repository.markSent(client, tenantId, id, actor.userId ?? null);
    });
  }

  async approve(id: string, actor: QuotationActor) {
    return this.transition(id, actor, "QUOTATION_APPROVED", async (client, tenantId, row, today) => {
      assertCanApprove({ status: row.status, validUntil: row.valid_until }, today);
      await this.repository.markApproved(client, tenantId, id, actor.userId ?? null);
    });
  }

  async reject(id: string, reason: unknown, actor: QuotationActor) {
    return this.transition(id, actor, "QUOTATION_REJECTED", async (client, tenantId, row) => {
      const normalized = assertCanReject({ status: row.status, validUntil: row.valid_until }, reason);
      await this.repository.markRejected(client, tenantId, id, normalized, actor.userId ?? null);
      return { reason: normalized };
    });
  }

  async renew(id: string, actor: QuotationActor) {
    const userId = actor.userId ?? null;
    return this.transition(id, actor, "QUOTATION_RENEWED", async (client, tenantId, row, today) => {
      assertCanRenew(
        { status: row.status, validUntil: row.valid_until, convertedOrderId: row.converted_order_id },
        today
      );
      const items = await this.repository.findItems(tenantId, id, client);
      const validityDays = await this.repository.getValidityDays(tenantId, client);
      const { header, priced } = await this.buildHeader(
        client,
        tenantId,
        id,
        row.branch_id,
        this.toInput(row, items),
        { issueDate: today, validityDays },
        userId
      );
      await this.repository.updateQuotation(client, { id, tenantId, resetToDraft: true, ...header });
      await this.repository.replaceItems(client, tenantId, id, priced.items);
      return { validUntil: header.validUntil, total: header.total };
    });
  }

  async duplicate(id: string, actor: QuotationActor) {
    const { tenantId, row } = await this.loadForActor(actor, id);
    const items = await this.repository.findItems(tenantId, id);
    const created = await this.create(
      { ...this.toInput(row, items), branchId: row.branch_id },
      actor
    );
    this.audit(tenantId, actor.userId, created.id, "QUOTATION_DUPLICATED", { sourceQuotationId: id });
    return created;
  }

  /**
   * Envia la cotizacion por correo con el PDF adjunto (generado en memoria por reporteria, sin guardarlo).
   * Destinatario: el correo del cliente o uno nuevo. Una cotizacion en borrador pasa a ENVIADA antes de
   * generar el PDF (para que el documento muestre ese estado) y vuelve a borrador si el correo no sale.
   */
  async sendByEmail(
    id: string,
    input: { to?: unknown; message?: unknown },
    actor: QuotationActor,
    authorization: string | undefined
  ) {
    const { tenantId, row } = await this.loadForActor(actor, id);
    const today = todayInBogota(this.clock());
    const effective = resolveEffectiveStatus(row.status, row.valid_until, today);
    if (effective !== "DRAFT" && effective !== "SENT" && effective !== "APPROVED") {
      throw new ConflictException(
        effective === "EXPIRED"
          ? "La cotizacion esta vencida. Renuevala antes de enviarla."
          : "Solo se pueden enviar cotizaciones en borrador, enviadas o aprobadas."
      );
    }

    const requested = typeof input?.to === "string" ? input.to.trim() : "";
    const to = requested || (row.customer_email ?? "").trim();
    if (!to) {
      throw new BadRequestException("El cliente no tiene correo registrado. Escribe el correo de destino.");
    }
    if (to.length > 254 || !isValidEmail(to)) {
      throw new BadRequestException("El correo de destino no es valido.");
    }
    const message = normalizeText(input?.message, "Mensaje");
    if (message && message.length > 2000) {
      throw new BadRequestException("El mensaje supera 2000 caracteres.");
    }

    const config = this.mailer.config();
    if (!config.ready) {
      throw new UnprocessableEntityException(
        `El envio de correo no esta configurado. Falta: ${config.missing.join(", ")}.`
      );
    }

    const userId = actor.userId ?? null;
    let sentAt: Date | null = null;
    if (row.status === "DRAFT") {
      sentAt = await this.inTransaction(async (client) => {
        const { row: locked } = await this.loadForActor(actor, id, { client, forUpdate: true });
        assertCanSend({ status: locked.status, validUntil: locked.valid_until }, today);
        return this.repository.markSent(client, tenantId, id, userId);
      });
    }

    const company = await this.repository.findCompany(tenantId);
    const companyName = company?.legal_name?.trim() || company?.name || "MANUS POS";
    const replyTo = company?.email && isValidEmail(company.email.trim()) ? company.email.trim() : null;
    let messageId: string | null = null;
    try {
      const pdf = await this.pdfClient.fetchPdf(id, authorization);
      const content = buildQuotationEmail({
        code: row.code,
        companyName,
        customerName: row.customer_name ?? "cliente",
        total: toNumber(row.total),
        validUntil: toDateOnly(row.valid_until),
        message,
      });
      const result = await this.mailer.send({
        to,
        replyTo,
        ...content,
        attachment: { filename: quotationPdfFileName(row.code), content: pdf },
      });
      messageId = result.messageId;
    } catch (error) {
      const reason = sanitizeMailError(error);
      if (sentAt) {
        await this.repository.revertSent(tenantId, id, sentAt).catch(() => undefined);
      }
      this.audit(tenantId, userId, id, "QUOTATION_EMAIL_FAILED", { code: row.code, to, error: reason });
      throw new BadGatewayException(`No se pudo enviar el correo: ${reason}`);
    }

    this.audit(tenantId, userId, id, "QUOTATION_EMAIL_SENT", {
      code: row.code,
      to,
      messageId,
      markedAsSent: Boolean(sentAt),
    });
    return { sent: true, to, quotation: await this.getById(id, actor) };
  }

  async convertToOrder(
    id: string,
    input: { type?: unknown },
    actor: QuotationActor,
    context?: InventoryContext
  ) {
    const type = input?.type === undefined || input?.type === null ? "CASH" : input.type;
    if (type !== "CASH" && type !== "CREDIT") {
      throw new BadRequestException("Tipo de pedido invalido");
    }
    const userId = actor.userId ?? null;

    const outcome = await this.inTransaction(async (client) => {
      const { tenantId, row } = await this.loadForActor(actor, id, { client, forUpdate: true });
      assertCanConvert(
        { status: row.status, validUntil: row.valid_until, convertedOrderId: row.converted_order_id },
        todayInBogota(this.clock())
      );
      await this.assertCustomer(client, tenantId, row.customer_id);
      const items = await this.repository.findItems(tenantId, id, client);
      const products = await this.repository.findProducts(
        client,
        tenantId,
        Array.from(new Set(items.map((item) => item.product_id)))
      );
      for (const item of items) {
        if (!products.get(item.product_id)?.is_active) {
          throw new BadRequestException(`El producto ${item.product_name} ya no esta activo.`);
        }
      }

      const pricingCalculatedAt = new Date(row.pricing_calculated_at);
      const order = await this.orderService.createOrderFromPricedItems(client, {
        tenantId,
        customerId: row.customer_id,
        branchId: row.branch_id,
        type,
        quotationId: id,
        context,
        actor,
        items: items.map((item) => {
          const mapped = this.mapItem(item);
          return {
            productId: mapped.productId,
            quantity: mapped.quantity,
            baseUnitPrice: mapped.baseUnitPrice,
            finalUnitPrice: mapped.finalUnitPrice,
            discountAmount: mapped.discountAmount,
            discountPercent: mapped.discountPercent,
            discountTotal: mapped.discountTotal,
            appliedPromotionId: mapped.appliedPromotionId,
            appliedPromotionName: mapped.appliedPromotionName,
            taxId: mapped.taxId,
            taxRate: mapped.taxRate,
            taxBase: mapped.taxBase,
            taxAmount: mapped.taxAmount,
            lineTotal: mapped.lineTotal,
            pricingSnapshot: mapped.pricingSnapshot,
            pricingCalculatedAt,
          };
        }),
      });
      await this.repository.markConverted(client, tenantId, id, order.id, userId);
      return { tenantId, row, order };
    });

    outcome.order.logCreated();
    this.audit(outcome.tenantId, userId, id, "QUOTATION_CONVERTED", {
      code: outcome.row.code,
      orderId: outcome.order.id,
      total: outcome.order.total,
    });
    const { logCreated: _logCreated, ...order } = outcome.order;
    return { quotation: await this.getById(id, actor), order };
  }

  private toInput(row: QuotationRow, items: QuotationItemRow[]): QuotationInput {
    return {
      customerId: row.customer_id,
      branchId: row.branch_id,
      commercialTerms: row.commercial_terms,
      paymentDeliveryTerms: row.payment_delivery_terms,
      warrantyTerms: row.warranty_terms,
      notes: row.notes,
      items: items.map((item) => ({ productId: item.product_id, quantity: toNumber(item.quantity) })),
    };
  }

  private async transition(
    id: string,
    actor: QuotationActor,
    action: string,
    work: (
      client: PoolClient,
      tenantId: string,
      row: QuotationRow,
      today: string
    ) => Promise<Record<string, unknown> | void>
  ) {
    const result = await this.inTransaction(async (client) => {
      const { tenantId, row } = await this.loadForActor(actor, id, { client, forUpdate: true });
      const extra = await work(client, tenantId, row, todayInBogota(this.clock()));
      return { tenantId, code: row.code, extra: extra ?? {} };
    });
    this.audit(result.tenantId, actor.userId, id, action, { code: result.code, ...result.extra });
    return this.getById(id, actor);
  }

  // ---------------------------------------------------------- configuracion

  async getSettings(actor: QuotationActor) {
    const tenantId = this.requireTenant(actor);
    return { defaultValidityDays: await this.repository.getValidityDays(tenantId) };
  }

  async updateSettings(input: { defaultValidityDays?: unknown }, actor: QuotationActor) {
    const tenantId = this.requireTenant(actor);
    const days = assertValidityDays(input?.defaultValidityDays);
    const saved = await this.repository.saveValidityDays(tenantId, days, actor.userId ?? null);
    this.auditService.logEvent({
      tenantId,
      userId: actor.userId ?? null,
      module: "quotations",
      entity: "quotation_settings",
      entityId: tenantId,
      action: "QUOTATION_SETTINGS_UPDATED",
      after: { defaultValidityDays: days },
    });
    return { defaultValidityDays: saved.default_validity_days };
  }
}
