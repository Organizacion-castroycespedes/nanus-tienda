import assert from "node:assert/strict";
import test from "node:test";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { CalculateLinePriceInput, LinePricePreview } from "../pricing/pricing.types";
import type { QuotationItemRow, QuotationRow } from "./quotation.repository";
import { QuotationService } from "./quotation.service";

const ids = {
  tenant: "20000000-0000-4000-8000-000000000001",
  branch: "20000000-0000-4000-8000-000000000002",
  otherBranch: "20000000-0000-4000-8000-000000000003",
  customer: "20000000-0000-4000-8000-000000000004",
  product: "20000000-0000-4000-8000-000000000005",
  product2: "20000000-0000-4000-8000-000000000006",
  user: "20000000-0000-4000-8000-000000000007",
  order: "20000000-0000-4000-8000-000000000008",
  tax: "20000000-0000-4000-8000-000000000009",
};

const admin = { roles: ["SUPER_ADMIN"], tenantId: ids.tenant, userId: ids.user };
const userAtBranch = { roles: ["USER"], tenantId: ids.tenant, userId: ids.user, branchId: ids.branch };
const userAtOtherBranch = { ...userAtBranch, branchId: ids.otherBranch };

// 2026-11-19 22:00 en Bogota.
const NOW = new Date("2026-11-20T03:00:00.000Z");

const preview = (input: CalculateLinePriceInput, unitPrice: number): LinePricePreview => {
  const taxBase = Math.round(unitPrice * input.quantity * 100) / 100;
  const taxAmount = Math.round(taxBase * 0.19 * 100) / 100;
  return {
    productId: input.productId,
    quantity: input.quantity,
    baseUnitPrice: unitPrice,
    finalUnitPrice: unitPrice,
    discountAmount: 0,
    discountPercent: 0,
    appliedPromotionId: null,
    appliedPromotionName: null,
    taxId: ids.tax,
    taxRate: 19,
    taxBase,
    taxAmount,
    taxes: [
      {
        taxId: ids.tax,
        taxName: "IVA",
        dianCode: "01",
        taxTypeCode: null,
        calculationMethodCode: null,
        taxRate: 19,
        taxBase,
        taxAmount,
        isIncluded: false,
      },
    ],
    lineSubtotal: taxBase,
    lineTotal: Math.round((taxBase + taxAmount) * 100) / 100,
    explanation: "test",
  };
};

class FakeClient {
  readonly statements: string[] = [];
  async query(text: string) {
    this.statements.push(text.trim().split(/\s+/)[0]);
    return { rows: [] };
  }
  release() {}
}

class FakeRepository {
  validityDays = 15;
  customerActive = true;
  products = new Map([
    [ids.product, { id: ids.product, name: "Cable", sku: "CAB-1", measurement_unit: "M", sale_type: "UNIT", allows_decimal_quantity: true, is_active: true }],
    [ids.product2, { id: ids.product2, name: "Bombillo", sku: "BOM-1", measurement_unit: "UND", sale_type: "UNIT", allows_decimal_quantity: false, is_active: true }],
  ]);
  row: QuotationRow | null = null;
  items: QuotationItemRow[] = [];
  calls: string[] = [];
  codes = 0;

  async getValidityDays() { return this.validityDays; }
  async saveValidityDays(_tenantId: string, days: number) {
    this.validityDays = days;
    return { default_validity_days: days, updated_at: NOW };
  }
  async findProducts(_client: unknown, _tenantId: string, productIds: string[]) {
    return new Map(productIds.filter((id) => this.products.has(id)).map((id) => [id, this.products.get(id)!]));
  }
  async findCustomer(_client: unknown, _tenantId: string, customerId: string) {
    return customerId === ids.customer ? { id: ids.customer, is_active: this.customerActive } : null;
  }
  async branchExists() { return true; }
  async nextCode() { this.codes += 1; return `COT-${String(this.codes).padStart(6, "0")}`; }
  async insertQuotation(_client: unknown, input: Record<string, any>) {
    this.calls.push("insert");
    this.row = {
      id: input.id, tenant_id: input.tenantId, branch_id: input.branchId, branch_name: "Principal",
      customer_id: input.customerId, customer_name: "Cliente", customer_document: "900", customer_email: "cliente@correo.co",
      customer_phone: null, customer_address: null, customer_is_active: true, code: input.code, status: "DRAFT",
      effective_status: "DRAFT", issue_date: input.issueDate, validity_days: input.validityDays,
      valid_until: input.validUntil, subtotal: input.subtotal, discount_total: input.discountTotal,
      tax_total: input.taxTotal, total: input.total, commercial_terms: input.commercialTerms,
      payment_delivery_terms: input.paymentDeliveryTerms, warranty_terms: input.warrantyTerms, notes: input.notes,
      pricing_calculated_at: input.pricingCalculatedAt, sent_at: null, approved_at: null, approved_by_user_id: null,
      rejected_at: null, rejection_reason: null, converted_order_id: null, converted_at: null,
      created_by_user_id: input.userId, updated_by_user_id: input.userId, created_at: NOW, updated_at: NOW,
    };
  }
  async updateQuotation(_client: unknown, input: Record<string, any>) {
    this.calls.push(input.resetToDraft ? "renew" : "update");
    Object.assign(this.row!, {
      issue_date: input.issueDate, validity_days: input.validityDays, valid_until: input.validUntil,
      total: input.total, subtotal: input.subtotal, tax_total: input.taxTotal,
      pricing_calculated_at: input.pricingCalculatedAt,
      ...(input.resetToDraft ? { status: "DRAFT", approved_at: null, sent_at: null } : {}),
    });
  }
  async replaceItems(_client: unknown, _tenantId: string, quotationId: string, items: Array<Record<string, any>>) {
    this.items = items.map((item, index) => ({
      id: `item-${index}`, quotation_id: quotationId, line_number: item.lineNumber, product_id: item.productId,
      product_name: item.productName, product_code: item.productCode, unit_code: item.unitCode,
      quantity: item.quantity, base_unit_price: item.baseUnitPrice, final_unit_price: item.finalUnitPrice,
      discount_amount: item.discountAmount, discount_percent: item.discountPercent, discount_total: item.discountTotal,
      applied_promotion_id: item.appliedPromotionId, applied_promotion_name: item.appliedPromotionName,
      tax_id: item.taxId, tax_rate: item.taxRate, tax_base: item.taxBase, tax_amount: item.taxAmount,
      line_total: item.lineTotal, pricing_snapshot: item.pricingSnapshot,
    }));
  }
  async findById(_tenantId: string, id: string, options: { forUpdate?: boolean } = {}) {
    if (options.forUpdate) this.calls.push("lock");
    return this.row && this.row.id === id ? { ...this.row } : null;
  }
  async findItems() { return this.items.map((item) => ({ ...item })); }
  async findConvertedOrder() { return { id: ids.order, status: "DRAFT", total: 0, created_at: NOW }; }
  revertedWith: Date | null = null;
  async markSent() {
    this.row!.status = "SENT";
    this.row!.sent_at = new Date("2026-11-20T03:05:00.000Z");
    return this.row!.sent_at as Date;
  }
  async revertSent(_tenantId: string, _id: string, sentAt: Date) {
    this.revertedWith = sentAt;
    this.row!.status = "DRAFT";
    this.row!.sent_at = null;
  }
  async findCompany() { return { name: "Tienda", legal_name: "Tienda SAS", email: "ventas@tienda.co" }; }
  async markApproved() { this.row!.status = "APPROVED"; this.row!.approved_at = NOW; }
  async markRejected(_c: unknown, _t: string, _id: string, reason: string) {
    this.row!.status = "REJECTED"; this.row!.rejection_reason = reason;
  }
  async markConverted(_c: unknown, _t: string, _id: string, orderId: string) {
    this.calls.push("converted");
    this.row!.status = "CONVERTED"; this.row!.converted_order_id = orderId;
  }
}

type BuildOptions = {
  prices?: Record<string, number>;
  orderFails?: boolean;
  mailReady?: boolean;
  mailFails?: boolean;
  pdfFails?: boolean;
};

const build = (options: BuildOptions = {}) => {
  const client = new FakeClient();
  const repository = new FakeRepository();
  const prices = { [ids.product]: 1000, [ids.product2]: 500, ...(options.prices ?? {}) };
  const pricingCalls: CalculateLinePriceInput[] = [];
  const orderCalls: Array<Record<string, any>> = [];
  const audit: Array<Record<string, any>> = [];
  const events: string[] = [];
  const mails: Array<Record<string, any>> = [];
  const pdfRequests: Array<{ id: string; authorization: string | undefined }> = [];
  const mailer = {
    config: () => ({
      ready: options.mailReady !== false,
      missing: options.mailReady === false ? ["CONTROL_CENTER_SMTP_HOST"] : [],
      smtp: { host: "smtp", port: 587, secure: false, user: null, password: null },
      from: "MANUS <no-reply@manus.co>",
    }),
    send: async (message: Record<string, any>) => {
      if (options.mailFails) throw new Error("connect ECONNREFUSED password=secreto");
      mails.push(message);
      return { messageId: "<msg-1>" };
    },
  };
  const pdfClient = {
    fetchPdf: async (id: string, authorization: string | undefined) => {
      pdfRequests.push({ id, authorization });
      if (options.pdfFails) throw new Error("Reportería respondió 500 al generar el PDF");
      return Buffer.from("%PDF-1.4 cotizacion");
    },
  };
  const pricing = {
    calculateLinePrice: async (input: CalculateLinePriceInput) => {
      pricingCalls.push(input);
      return preview(input, prices[input.productId]);
    },
  };
  const orderService = {
    createOrderFromPricedItems: async (_client: unknown, input: Record<string, any>) => {
      orderCalls.push(input);
      if (options.orderFails) throw new BadRequestException("terminal not found for tenant branch");
      const total = input.items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
      return { id: ids.order, total, status: "DRAFT", quotationId: input.quotationId, logCreated: () => events.push("order-audit") };
    },
  };
  const service = new QuotationService(
    { getClient: async () => client } as never,
    repository as never,
    pricing as never,
    orderService as never,
    { logEvent: (event: Record<string, any>) => { audit.push(event); events.push(`audit:${event.action}`); } } as never,
    { findAccessibleBranchIds: async () => [ids.branch] } as never,
    mailer as never,
    pdfClient as never
  );
  service.clock = () => NOW;
  return { service, client, repository, prices, pricingCalls, orderCalls, audit, events, mails, pdfRequests };
};

const createDraft = async (ctx: ReturnType<typeof build>) =>
  ctx.service.create(
    {
      customerId: ids.customer,
      branchId: ids.branch,
      items: [
        { productId: ids.product, quantity: 10.85, price: 1 } as never,
        { productId: ids.product2, quantity: 2 },
      ],
      commercialTerms: "  50% anticipo  ",
    },
    admin
  );

test("create valoriza con el motor (canal ORDER), asigna consecutivo y vigencia de 15 dias", async () => {
  const ctx = build();
  const result = await createDraft(ctx);

  assert.equal(result.code, "COT-000001");
  assert.equal(result.status, "DRAFT");
  assert.equal(result.issueDate, "2026-11-19");
  assert.equal(result.validUntil, "2026-12-04");
  assert.equal(result.commercialTerms, "50% anticipo");
  assert.deepEqual(ctx.pricingCalls.map((call) => call.channel), ["ORDER", "ORDER"]);
  assert.equal(ctx.pricingCalls[0].customerId, ids.customer);
  assert.equal(result.items[0].finalUnitPrice, 1000);
  assert.equal(result.subtotal, 11850);
  assert.equal(result.taxTotal, 2251.5);
  assert.equal(result.total, 14101.5);
  assert.equal(result.items[0].pricingSnapshot.channel, "QUOTATION");
  assert.equal((result.items[0].pricingSnapshot.result as LinePricePreview).taxes.length, 1);
  assert.deepEqual(result.taxSummary, [{ taxName: "IVA", taxRate: 19, taxBase: 11850, taxAmount: 2251.5 }]);
  assert.deepEqual(ctx.client.statements, ["BEGIN", "COMMIT"]);
  assert.equal(ctx.audit[0].action, "QUOTATION_CREATED");
});

test("create usa la vigencia configurada del tenant", async () => {
  const ctx = build();
  ctx.repository.validityDays = 30;
  const result = await createDraft(ctx);
  assert.equal(result.validUntil, "2026-12-19");
});

test("create rechaza sin cliente, cliente inactivo, sin lineas, producto inexistente y decimal no permitido", async () => {
  const ctx = build();
  await assert.rejects(ctx.service.create({ customerId: "", branchId: ids.branch, items: [{ productId: ids.product, quantity: 1 }] }, admin), /cliente es obligatorio/);
  await assert.rejects(ctx.service.create({ customerId: ids.customer, branchId: ids.branch, items: [] }, admin), /al menos un producto/);
  await assert.rejects(
    ctx.service.create({ customerId: ids.customer, branchId: ids.branch, items: [{ description: "Servicio" } as never] }, admin),
    /producto del catalogo/
  );
  await assert.rejects(
    ctx.service.create({ customerId: ids.customer, branchId: ids.branch, items: [{ productId: "20000000-0000-4000-8000-0000000000ff", quantity: 1 }] }, admin),
    /no existe o esta inactivo/
  );
  await assert.rejects(
    ctx.service.create({ customerId: ids.customer, branchId: ids.branch, items: [{ productId: ids.product2, quantity: 2.5 }] }, admin),
    /unidades enteras/
  );
  ctx.repository.customerActive = false;
  await assert.rejects(
    ctx.service.create({ customerId: ids.customer, branchId: ids.branch, items: [{ productId: ids.product, quantity: 1 }] }, admin),
    /inactivo/
  );
  assert.equal(ctx.repository.row, null);
  assert.ok(ctx.client.statements.filter((s) => s === "ROLLBACK").length >= 4);
});

test("USER no puede cotizar ni consultar en otra sucursal", async () => {
  const ctx = build();
  await assert.rejects(
    ctx.service.create({ customerId: ids.customer, branchId: ids.otherBranch, items: [{ productId: ids.product, quantity: 1 }] }, userAtBranch),
    ForbiddenException
  );
  const created = await createDraft(ctx);
  await assert.rejects(ctx.service.getById(created.id, userAtOtherBranch), ForbiddenException);
});

test("update recalcula precios en borrador y se bloquea al aprobar", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  ctx.prices[ids.product2] = 600;
  const updated = await ctx.service.update(created.id, { customerId: ids.customer, items: [{ productId: ids.product2, quantity: 1 }] }, admin);
  assert.equal(updated.total, 714);
  assert.equal(updated.validUntil, "2026-12-04");

  await ctx.service.approve(created.id, admin);
  await assert.rejects(
    ctx.service.update(created.id, { customerId: ids.customer, items: [{ productId: ids.product2, quantity: 3 }] }, admin),
    ConflictException
  );
});

test("convertir respeta el precio cotizado aunque el precio de lista haya cambiado", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  await ctx.service.send(created.id, admin);
  await ctx.service.approve(created.id, admin);
  ctx.prices[ids.product] = 99999;
  const pricingCallsBefore = ctx.pricingCalls.length;
  ctx.events.length = 0;
  ctx.client.statements.length = 0;

  const result = await ctx.service.convertToOrder(created.id, { type: "CREDIT" }, admin);

  assert.equal(ctx.pricingCalls.length, pricingCallsBefore);
  assert.equal(ctx.orderCalls.length, 1);
  const call = ctx.orderCalls[0];
  assert.equal(call.quotationId, created.id);
  assert.equal(call.type, "CREDIT");
  assert.equal(call.branchId, ids.branch);
  assert.equal(call.items[0].finalUnitPrice, 1000);
  assert.equal(call.items[0].quantity, 10.85);
  assert.equal(call.items[0].pricingSnapshot.channel, "QUOTATION");
  assert.ok(call.items[0].pricingCalculatedAt instanceof Date);
  assert.equal(result.order.id, ids.order);
  assert.equal("logCreated" in result.order, false);
  assert.equal(result.quotation.status, "CONVERTED");
  assert.equal(result.quotation.convertedOrderId, ids.order);
  assert.deepEqual(ctx.client.statements, ["BEGIN", "COMMIT"]);
  // La auditoria del pedido y de la conversion van despues del COMMIT.
  assert.deepEqual(ctx.events, ["order-audit", "audit:QUOTATION_CONVERTED"]);
  assert.ok(ctx.repository.calls.includes("lock"));
});

test("convertir rechaza cotizacion no aprobada, vencida o ya convertida", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  await assert.rejects(ctx.service.convertToOrder(created.id, {}, admin), /aprobadas/);

  await ctx.service.approve(created.id, admin);
  ctx.service.clock = () => new Date("2026-12-06T15:00:00.000Z");
  await assert.rejects(ctx.service.convertToOrder(created.id, {}, admin), /vencida/);

  ctx.service.clock = () => NOW;
  await ctx.service.convertToOrder(created.id, {}, admin);
  await assert.rejects(
    ctx.service.convertToOrder(created.id, {}, admin),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { orderId?: string }).orderId === ids.order
  );
  assert.equal(ctx.orderCalls.length, 1);
});

test("si falla la creacion del pedido se revierte y la cotizacion sigue aprobada", async () => {
  const ctx = build({ orderFails: true });
  const created = await createDraft(ctx);
  await ctx.service.approve(created.id, admin);
  ctx.client.statements.length = 0;

  await assert.rejects(ctx.service.convertToOrder(created.id, {}, admin), /terminal not found/);
  assert.deepEqual(ctx.client.statements, ["BEGIN", "ROLLBACK"]);
  assert.equal(ctx.repository.calls.includes("converted"), false);
  assert.equal(ctx.repository.row!.status, "APPROVED");
});

test("convertir rechaza tipo de pedido invalido y cliente inactivo", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  await ctx.service.approve(created.id, admin);
  await assert.rejects(ctx.service.convertToOrder(created.id, { type: "GIFT" }, admin), /Tipo de pedido/);
  ctx.repository.customerActive = false;
  await assert.rejects(ctx.service.convertToOrder(created.id, {}, admin), /inactivo/);
  assert.equal(ctx.orderCalls.length, 0);
});

test("rechazar exige motivo", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  await assert.rejects(ctx.service.reject(created.id, "  ", admin), BadRequestException);
  const rejected = await ctx.service.reject(created.id, "Precio fuera de presupuesto", admin);
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.rejectionReason, "Precio fuera de presupuesto");
});

test("renovar solo vencidas: recalcula precios, nueva vigencia y vuelve a borrador", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  await ctx.service.approve(created.id, admin);
  await assert.rejects(ctx.service.renew(created.id, admin), /vencidas/);

  ctx.service.clock = () => new Date("2026-12-10T15:00:00.000Z");
  ctx.prices[ids.product] = 1200;
  const before = await ctx.service.getById(created.id, admin);
  assert.equal(before.effectiveStatus, "EXPIRED");

  const renewed = await ctx.service.renew(created.id, admin);
  assert.equal(renewed.status, "DRAFT");
  assert.equal(renewed.effectiveStatus, "DRAFT");
  assert.equal(renewed.issueDate, "2026-12-10");
  assert.equal(renewed.validUntil, "2026-12-25");
  assert.equal(renewed.items[0].finalUnitPrice, 1200);
});

test("duplicar crea una nueva cotizacion en borrador con precios actuales", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  ctx.prices[ids.product2] = 700;
  const copy = await ctx.service.duplicate(created.id, admin);
  assert.equal(copy.code, "COT-000002");
  assert.equal(copy.status, "DRAFT");
  assert.equal(copy.items[1].finalUnitPrice, 700);
  assert.ok(ctx.audit.some((event) => event.action === "QUOTATION_DUPLICATED"));
});

test("configuracion de vigencia valida el rango", async () => {
  const ctx = build();
  assert.deepEqual(await ctx.service.getSettings(admin), { defaultValidityDays: 15 });
  await assert.rejects(ctx.service.updateSettings({ defaultValidityDays: 400 }, admin), BadRequestException);
  assert.deepEqual(await ctx.service.updateSettings({ defaultValidityDays: 20 }, admin), { defaultValidityDays: 20 });
});

test("enviar por correo al cliente: pasa a ENVIADA, adjunta el PDF en memoria y responde el destinatario", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  const result = await ctx.service.sendByEmail(created.id, { message: "Quedamos atentos." }, admin, "Bearer token-1");

  assert.equal(result.sent, true);
  assert.equal(result.to, "cliente@correo.co");
  assert.equal(result.quotation.status, "SENT");
  assert.deepEqual(ctx.pdfRequests, [{ id: created.id, authorization: "Bearer token-1" }]);
  assert.equal(ctx.mails.length, 1);
  const mail = ctx.mails[0];
  assert.equal(mail.to, "cliente@correo.co");
  assert.equal(mail.replyTo, "ventas@tienda.co");
  assert.equal(mail.attachment.filename, "cotizacion-COT-000001.pdf");
  assert.ok(Buffer.isBuffer(mail.attachment.content));
  assert.match(mail.subject, /COT-000001/);
  assert.match(mail.text, /Quedamos atentos\./);
  assert.ok(ctx.audit.some((event) => event.action === "QUOTATION_EMAIL_SENT" && event.after.markedAsSent === true));
});

test("enviar a otro correo y reenviar una aprobada no cambia su estado", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  await ctx.service.approve(created.id, admin);
  const result = await ctx.service.sendByEmail(created.id, { to: "  compras@otra.co " }, admin, "Bearer t");
  assert.equal(result.to, "compras@otra.co");
  assert.equal(result.quotation.status, "APPROVED");
  assert.equal(ctx.mails[0].to, "compras@otra.co");
});

test("enviar por correo valida destinatario, estado y configuracion SMTP", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  await assert.rejects(ctx.service.sendByEmail(created.id, { to: "no-es-correo" }, admin, "Bearer t"), BadRequestException);
  ctx.repository.row!.customer_email = null;
  await assert.rejects(ctx.service.sendByEmail(created.id, {}, admin, "Bearer t"), /no tiene correo/);

  ctx.service.clock = () => new Date("2026-12-10T15:00:00.000Z");
  await assert.rejects(ctx.service.sendByEmail(created.id, { to: "a@b.co" }, admin, "Bearer t"), /vencida/);

  const noSmtp = build({ mailReady: false });
  const other = await createDraft(noSmtp);
  await assert.rejects(noSmtp.service.sendByEmail(other.id, {}, admin, "Bearer t"), UnprocessableEntityException);
  assert.equal(noSmtp.repository.row!.status, "DRAFT");
  assert.equal(ctx.mails.length + noSmtp.mails.length, 0);
});

test("si el correo o el PDF fallan, la cotizacion vuelve a borrador y no se filtran credenciales", async () => {
  for (const options of [{ mailFails: true }, { pdfFails: true }]) {
    const ctx = build(options);
    const created = await createDraft(ctx);
    await assert.rejects(
      ctx.service.sendByEmail(created.id, {}, admin, "Bearer t"),
      (error: unknown) =>
        error instanceof BadGatewayException && !String(error.message).includes("secreto")
    );
    assert.equal(ctx.repository.row!.status, "DRAFT");
    assert.ok(ctx.repository.revertedWith instanceof Date);
    assert.ok(ctx.audit.some((event) => event.action === "QUOTATION_EMAIL_FAILED"));
  }
});

test("rechazada o convertida no se envia por correo", async () => {
  const ctx = build();
  const created = await createDraft(ctx);
  await ctx.service.reject(created.id, "No aplica", admin);
  await assert.rejects(ctx.service.sendByEmail(created.id, {}, admin, "Bearer t"), ConflictException);
});
