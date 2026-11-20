import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { OrderService } from "./order.service";

const ids = {
  tenant: "30000000-0000-4000-8000-000000000001",
  branch: "30000000-0000-4000-8000-000000000002",
  otherBranch: "30000000-0000-4000-8000-000000000003",
  customer: "30000000-0000-4000-8000-000000000004",
  product: "30000000-0000-4000-8000-000000000005",
  quotation: "30000000-0000-4000-8000-000000000006",
  tax: "30000000-0000-4000-8000-000000000007",
  user: "30000000-0000-4000-8000-000000000008",
};

class FakeClient {
  readonly sql: string[] = [];
  insertedOrder: unknown[] | null = null;
  readonly items: unknown[][] = [];
  taxes: Array<Record<string, unknown>> = [];
  quotationLink: unknown[] | null = null;

  async query<T>(text: string, params: unknown[] = []) {
    const sql = text.replace(/\s+/g, " ").trim();
    this.sql.push(sql.split(" ").slice(0, 3).join(" "));
    if (sql.includes("FROM customers") || sql.includes("FROM products") || sql.includes("FROM tenant_branches")) {
      return { rows: [{ id: params[0] }] as T[] };
    }
    if (sql.startsWith("INSERT INTO orders")) {
      this.insertedOrder = params;
      return {
        rows: [
          {
            id: params[0], tenant_id: params[1], customer_id: params[2], cash_session_id: params[3],
            type: params[4], status: params[5], total: params[6], payment_status: params[7],
            total_paid: params[8], balance_due: params[9], created_at: params[10],
          },
        ] as T[],
      };
    }
    if (sql.includes("prc_replace_order_item_taxes")) {
      const payload = (params[2] === undefined ? [] : JSON.parse(String(params[2]))) as Array<Record<string, unknown>>;
      if (payload.length > 0) this.taxes = payload;
      return { rows: [{ ok: true }] as T[] };
    }
    if (sql.startsWith("INSERT INTO order_items")) {
      this.items.push(params);
      return { rows: [] as T[] };
    }
    if (sql.startsWith("UPDATE orders SET quotation_id")) {
      this.quotationLink = params;
      return { rows: [] as T[] };
    }
    return { rows: [] as T[] };
  }
}

const buildService = () => {
  const audit: Array<Record<string, any>> = [];
  let pricingCalls = 0;
  let getClientCalls = 0;
  const service = new OrderService(
    { getClient: async () => { getClientCalls += 1; return {} as never; } } as never,
    { logEvent: (event: Record<string, any>) => audit.push(event) } as never,
    { findAccessibleBranchIds: async () => [] } as never,
    {} as never,
    {} as never,
    { calculateLinePrice: async () => { pricingCalls += 1; throw new Error("no debe recalcular"); } } as never
  );
  return { service, audit, pricingCalls: () => pricingCalls, getClientCalls: () => getClientCalls };
};

const quotedItem = {
  productId: ids.product,
  quantity: 3,
  baseUnitPrice: 1000,
  finalUnitPrice: 900,
  discountAmount: 100,
  discountPercent: 10,
  discountTotal: 300,
  appliedPromotionId: null,
  appliedPromotionName: "Promo",
  taxId: ids.tax,
  taxRate: 19,
  taxBase: 2700,
  taxAmount: 513,
  lineTotal: 3213,
  pricingSnapshot: {
    channel: "QUOTATION",
    quotationId: ids.quotation,
    result: {
      taxes: [
        { taxId: ids.tax, taxName: "IVA", dianCode: "01", taxTypeCode: null, calculationMethodCode: null,
          taxRate: 19, taxBase: 2700, taxAmount: 513, isIncluded: false },
      ],
    },
  },
  pricingCalculatedAt: new Date("2026-11-19T15:00:00.000Z"),
};

test("createOrderFromPricedItems usa los precios cotizados sin recalcular ni abrir transaccion", async () => {
  const { service, audit, pricingCalls, getClientCalls } = buildService();
  const client = new FakeClient();

  const result = await service.createOrderFromPricedItems(client as unknown as PoolClient, {
    tenantId: ids.tenant,
    customerId: ids.customer,
    branchId: ids.branch,
    type: "CREDIT",
    quotationId: ids.quotation,
    items: [quotedItem],
    context: { tenantId: ids.tenant, branchId: ids.branch, terminalId: null, userId: ids.user, cashSessionId: null } as never,
    actor: { roles: ["SUPER_ADMIN"], tenantId: ids.tenant, userId: ids.user },
  });

  assert.equal(pricingCalls(), 0);
  assert.equal(getClientCalls(), 0);
  assert.equal(client.sql.some((statement) => /^(BEGIN|COMMIT|ROLLBACK)/.test(statement)), false);
  assert.equal(result.status, "DRAFT");
  assert.equal(result.type, "CREDIT");
  assert.equal(result.total, 3213);
  assert.equal(result.quotationId, ids.quotation);
  assert.equal(client.items.length, 1);
  const item = client.items[0];
  assert.equal(item[3], 3); // ordered_quantity
  assert.equal(item[5], 900); // price
  assert.equal(item[8], 900); // final_unit_price
  assert.equal(item[18], 3213); // line_total
  assert.equal(JSON.parse(String(item[19])).channel, "QUOTATION");
  assert.equal(client.taxes.length, 1);
  assert.equal(client.taxes[0].tax_amount, 513);
  assert.deepEqual(client.quotationLink?.slice(1), [ids.tenant, ids.quotation]);

  // La auditoria ORDER_CREATED solo se emite cuando quien llama confirma (despues del COMMIT).
  assert.equal(audit.length, 0);
  result.logCreated();
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "ORDER_CREATED");
  assert.equal(audit[0].after.branchId, ids.branch);
  assert.equal(audit[0].after.quotationId, ids.quotation);
});

test("createOrderFromPricedItems rechaza sucursal fuera del alcance de un USER", async () => {
  const { service } = buildService();
  const client = new FakeClient();
  await assert.rejects(
    service.createOrderFromPricedItems(client as unknown as PoolClient, {
      tenantId: ids.tenant,
      customerId: ids.customer,
      branchId: ids.otherBranch,
      quotationId: ids.quotation,
      items: [quotedItem],
      actor: { roles: ["USER"], tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    }),
    ForbiddenException
  );
  assert.equal(client.insertedOrder, null);
});

test("createOrderFromPricedItems exige lineas", async () => {
  const { service } = buildService();
  await assert.rejects(
    service.createOrderFromPricedItems(new FakeClient() as unknown as PoolClient, {
      tenantId: ids.tenant,
      customerId: ids.customer,
      branchId: ids.branch,
      quotationId: ids.quotation,
      items: [],
      actor: { roles: ["SUPER_ADMIN"], tenantId: ids.tenant },
    }),
    /order items are required/
  );
});
