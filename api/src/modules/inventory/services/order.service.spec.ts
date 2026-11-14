import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { OrderService } from "./order.service";
import type {
  CalculateLinePriceInput,
  LinePricePreview,
} from "../../pricing/pricing.types";

const ids = {
  tenant: "10000000-0000-0000-0000-000000000001",
  branch: "10000000-0000-0000-0000-000000000002",
  customer: "10000000-0000-0000-0000-000000000003",
  otherCustomer: "10000000-0000-0000-0000-000000000004",
  user: "10000000-0000-0000-0000-000000000005",
  order: "10000000-0000-0000-0000-000000000006",
  product: "10000000-0000-0000-0000-000000000007",
  promotion: "10000000-0000-0000-0000-000000000008",
  tax: "10000000-0000-0000-0000-000000000009",
  otherBranch: "10000000-0000-0000-0000-000000000010",
  terminal: "10000000-0000-0000-0000-000000000011",
  cashSession: "10000000-0000-0000-0000-000000000012",
};

type RecordedQuery = {
  text: string;
  params: unknown[];
};

type InsertedOrder = {
  total: number;
  balanceDue: number;
  cashSessionId: unknown;
};

type InsertedItem = {
  productId: unknown;
  quantity: unknown;
  price: unknown;
  subtotal: unknown;
  baseUnitPrice: unknown;
  finalUnitPrice: unknown;
  discountAmount: unknown;
  discountPercent: unknown;
  discountTotal: unknown;
  appliedPromotionId: unknown;
  appliedPromotionName: unknown;
  taxId: unknown;
  taxRate: unknown;
  taxBase: unknown;
  taxAmount: unknown;
  lineTotal: unknown;
  pricingSnapshot: Record<string, unknown> | null;
  pricingCalculatedAt: unknown;
};

type InsertedOrderItemTax = {
  orderItemId: unknown;
  taxId: unknown;
  taxName: unknown;
  taxRate: unknown;
  taxBase: unknown;
  taxAmount: unknown;
  dianCode: unknown;
  taxTypeCode: unknown;
  calculationMethodCode: unknown;
  calculationOrder: unknown;
  isIncluded: unknown;
};

const actor = {
  roles: ["SUPER_ADMIN"],
  tenantId: ids.tenant,
  userId: ids.user,
};

const makePreview = (
  overrides: Partial<LinePricePreview> = {}
): LinePricePreview => ({
  productId: ids.product,
  quantity: 2,
  baseUnitPrice: 100,
  finalUnitPrice: 100,
  discountAmount: 0,
  discountPercent: 0,
  appliedPromotionId: null,
  appliedPromotionName: null,
  taxId: null,
  taxRate: 0,
  taxBase: 200,
  taxAmount: 0,
  taxes: [],
  lineSubtotal: 200,
  lineTotal: 200,
  explanation: "test pricing",
  ...overrides,
});

class FakePricingService {
  readonly calls: CalculateLinePriceInput[] = [];

  constructor(private readonly previews: LinePricePreview[]) {}

  async calculateLinePrice(input: CalculateLinePriceInput) {
    this.calls.push(input);
    const preview = this.previews.shift() ?? makePreview();
    return {
      ...preview,
      productId: input.productId,
      quantity: input.quantity,
    };
  }
}

class FakeOrderClient {
  readonly queries: RecordedQuery[] = [];
  readonly insertedItems: InsertedItem[] = [];
  readonly insertedItemTaxes: InsertedOrderItemTax[] = [];
  insertedOrder: InsertedOrder | null = null;
  updatedOrder: InsertedOrder | null = null;
  deletedItemTaxes = false;
  deletedItems = false;
  committed = false;
  rolledBack = false;
  released = false;

  constructor(
    private readonly options: {
      currentStatus?: "DRAFT" | "CONFIRMED" | "PARTIAL" | "COMPLETED" | "CANCELLED";
      currentTotal?: number;
      currentTotalPaid?: number;
      auditBranchId?: string | null;
      terminalBranchId?: string | null;
    } = {}
  ) {}

  async query<T>(text: string, params: unknown[] = []) {
    this.queries.push({ text, params });
    const sql = text.replace(/\s+/g, " ").trim();

    if (sql === "BEGIN") {
      return { rows: [] as T[] };
    }
    if (sql === "COMMIT") {
      this.committed = true;
      return { rows: [] as T[] };
    }
    if (sql === "ROLLBACK") {
      this.rolledBack = true;
      return { rows: [] as T[] };
    }

    if (sql.includes("FROM customers")) {
      return { rows: [{ id: params[0] }] as T[] };
    }

    if (sql.includes("FROM products") && !sql.includes("INNER JOIN")) {
      return { rows: [{ id: params[0] }] as T[] };
    }

    if (sql.includes("FROM tenant_branches")) {
      return { rows: [{ id: params[0] }] as T[] };
    }

    if (sql.includes("FROM terminals")) {
      const terminalBranchId = this.options.terminalBranchId ?? ids.branch;
      if (
        params[0] === ids.terminal &&
        params[1] === ids.tenant &&
        params[2] === terminalBranchId
      ) {
        return { rows: [{ id: ids.terminal, name: "Terminal QA" }] as T[] };
      }
      return { rows: [] as T[] };
    }

    if (sql.includes("auditoria_eventos")) {
      return {
        rows: [
          {
            branch_id: this.options.auditBranchId ?? ids.branch,
            branch_name: "Sucursal QA",
            terminal_id: null,
            terminal_name: null,
          },
        ] as T[],
      };
    }

    if (sql.includes("FROM orders") && sql.includes("LIMIT 1")) {
      const total = this.options.currentTotal ?? 500;
      return {
        rows: [
          {
            id: params[0] ?? ids.order,
            tenant_id: ids.tenant,
            customer_id: ids.customer,
            type: "CASH",
            status: this.options.currentStatus ?? "DRAFT",
            total,
            payment_status: "PENDING",
            total_paid: this.options.currentTotalPaid ?? 0,
            balance_due: total,
            created_at: new Date("2026-06-01T10:00:00.000Z"),
          },
        ] as T[],
      };
    }

    if (sql.startsWith("INSERT INTO orders")) {
      this.insertedOrder = {
        total: Number(params[6]),
        balanceDue: Number(params[9]),
        cashSessionId: params[3],
      };
      return {
        rows: [
          {
            id: params[0],
            tenant_id: params[1],
            customer_id: params[2],
            cash_session_id: params[3],
            type: params[4],
            status: params[5],
            total: params[6],
            payment_status: params[7],
            total_paid: params[8],
            balance_due: params[9],
            created_at: params[10],
          },
        ] as T[],
      };
    }

    if (sql.startsWith("UPDATE orders")) {
      this.updatedOrder = {
        total: Number(params[5]),
        balanceDue: Number(params[7]),
      };
      return {
        rows: [
          {
            id: params[0],
            tenant_id: params[1],
            customer_id: params[2] ?? ids.customer,
            type: params[3],
            status: params[4] ?? "DRAFT",
            total: params[5],
            payment_status: params[8],
            total_paid: params[6],
            balance_due: params[7],
            created_at: new Date("2026-06-01T10:00:00.000Z"),
          },
        ] as T[],
      };
    }

    if (sql.includes("prc_replace_order_item_taxes")) {
      this.deletedItemTaxes = true;
      const taxesJson = params[2];
      if (typeof taxesJson === "string") {
        const taxes = JSON.parse(taxesJson) as Array<Record<string, unknown>>;
        for (const tax of taxes) {
          this.insertedItemTaxes.push({
            orderItemId: String(tax.order_item_id),
            taxId: String(tax.tax_id),
            taxName: String(tax.tax_name),
            taxRate: Number(tax.tax_rate),
            taxBase: Number(tax.tax_base),
            taxAmount: Number(tax.tax_amount),
            dianCode: (tax.dian_code as string | null) ?? null,
            taxTypeCode: (tax.tax_type_code as string | null) ?? null,
            calculationMethodCode:
              (tax.calculation_method_code as string | null) ?? null,
            calculationOrder: Number(tax.calculation_order ?? 0),
            isIncluded: Boolean(tax.is_included),
          });
        }
      }
      return { rows: [{ ok: true }] as T[] };
    }

    if (sql.startsWith("DELETE FROM order_items")) {
      this.deletedItems = true;
      return { rows: [] as T[] };
    }

    if (sql.startsWith("INSERT INTO order_items")) {
      this.insertedItems.push({
        productId: params[2],
        quantity: params[3],
        price: params[5],
        subtotal: params[6],
        baseUnitPrice: params[7],
        finalUnitPrice: params[8],
        discountAmount: params[9],
        discountPercent: params[10],
        discountTotal: params[11],
        appliedPromotionId: params[12],
        appliedPromotionName: params[13],
        taxId: params[14],
        taxRate: params[15],
        taxBase: params[16],
        taxAmount: params[17],
        lineTotal: params[18],
        pricingSnapshot:
          typeof params[19] === "string"
            ? (JSON.parse(params[19]) as Record<string, unknown>)
            : null,
        pricingCalculatedAt: params[20],
      });
      return { rows: [] as T[] };
    }

    if (sql.includes("FROM order_items")) {
      return { rows: [] as T[] };
    }

    throw new Error(`Unexpected SQL in OrderService test: ${sql}`);
  }

  release() {
    this.released = true;
  }
}

const buildService = (
  previews: LinePricePreview[],
  clientOptions: ConstructorParameters<typeof FakeOrderClient>[0] = {}
) => {
  const client = new FakeOrderClient(clientOptions);
  const pricingService = new FakePricingService([...previews]);
  let getClientCalls = 0;
  const auditEvents: unknown[] = [];

  const service = new OrderService(
    {
      getClient: async () => {
        getClientCalls += 1;
        return client as unknown as PoolClient;
      },
    } as never,
    {
      logEvent: (event: unknown) => {
        auditEvents.push(event);
      },
    } as never,
    { findAccessibleBranchIds: async () => [] } as never,
    {} as never,
    {} as never,
    pricingService as never
  );

  return {
    service,
    client,
    pricingService,
    auditEvents,
    getClientCalls: () => getClientCalls,
  };
};

const createPayload = () => ({
  tenantId: ids.tenant,
  customerId: ids.customer,
  branchId: ids.branch,
  type: "CASH" as const,
  total: 9999,
  items: [
    {
      productId: ids.product,
      quantity: 2,
      price: 1,
      subtotal: 2,
    },
  ],
  actor,
});

test("OrderService.createOrder ignores frontend price and total and uses PricingService", async () => {
  const { service, client, pricingService } = buildService([
    makePreview({
      baseUnitPrice: 150,
      finalUnitPrice: 120,
      discountAmount: 30,
      discountPercent: 20,
      taxBase: 201.68,
      taxAmount: 38.32,
      taxes: [
        {
          taxId: ids.tax,
          taxName: "IVA",
          dianCode: "01",
          taxTypeCode: "VAT",
          calculationMethodCode: "PERCENTAGE",
          taxRate: 0.19,
          taxBase: 201.68,
          taxAmount: 38.32,
          isIncluded: true,
        },
      ],
      lineSubtotal: 201.68,
      lineTotal: 240,
    }),
  ]);

  const result = await service.createOrder(createPayload());

  assert.equal(result.total, 240);
  assert.equal(client.insertedOrder?.total, 240);
  assert.equal(client.insertedOrder?.balanceDue, 240);
  assert.equal(client.insertedItems[0]?.price, 120);
  assert.equal(client.insertedItems[0]?.subtotal, 240);
  assert.equal(client.insertedItemTaxes.length, 1);
  assert.equal(client.insertedItemTaxes[0]?.taxId, ids.tax);
  assert.equal(client.insertedItemTaxes[0]?.taxName, "IVA");
  assert.equal(client.insertedItemTaxes[0]?.dianCode, "01");
  assert.equal(pricingService.calls.length, 1);
  assert.deepEqual(
    {
      tenantId: pricingService.calls[0].tenantId,
      branchId: pricingService.calls[0].branchId,
      customerId: pricingService.calls[0].customerId,
      productId: pricingService.calls[0].productId,
      quantity: pricingService.calls[0].quantity,
      channel: pricingService.calls[0].channel,
    },
    {
      tenantId: ids.tenant,
      branchId: ids.branch,
      customerId: ids.customer,
      productId: ids.product,
      quantity: 2,
      channel: "ORDER",
    }
  );
});

test("OrderService.createOrder persists snapshot without promotion", async () => {
  const { service, client } = buildService([
    makePreview({
      baseUnitPrice: 100,
      finalUnitPrice: 100,
      discountAmount: 0,
      discountPercent: 0,
      appliedPromotionId: null,
      appliedPromotionName: null,
      taxId: ids.tax,
      taxRate: 0.19,
      taxBase: 200,
      taxAmount: 38,
      lineSubtotal: 200,
      lineTotal: 238,
    }),
  ]);

  await service.createOrder(createPayload());

  const item = client.insertedItems[0];
  assert.equal(item.baseUnitPrice, 100);
  assert.equal(item.finalUnitPrice, 100);
  assert.equal(item.discountAmount, 0);
  assert.equal(item.discountPercent, 0);
  assert.equal(item.discountTotal, 0);
  assert.equal(item.appliedPromotionId, null);
  assert.equal(item.appliedPromotionName, null);
  assert.equal(item.taxId, ids.tax);
  assert.equal(item.taxRate, 0.19);
  assert.equal(item.taxBase, 200);
  assert.equal(item.taxAmount, 38);
  assert.equal(item.lineTotal, 238);
  assert.equal(item.pricingSnapshot?.["channel"], "ORDER");
  assert.equal(item.pricingSnapshot?.["productId"], ids.product);
  assert.ok(item.pricingCalculatedAt instanceof Date);
});

test("OrderService.createOrder persists multi-tax whisky into order_item_taxes", async () => {
  const iclTaxId = "10000000-0000-0000-0000-000000000031";
  const advTaxId = "10000000-0000-0000-0000-000000000032";
  const ivaTaxId = "10000000-0000-0000-0000-000000000033";
  const { service, client } = buildService([
    makePreview({
      baseUnitPrice: 590000,
      finalUnitPrice: 590000,
      discountAmount: 0,
      discountPercent: 0,
      appliedPromotionId: null,
      appliedPromotionName: null,
      taxId: ivaTaxId,
      taxRate: 0.05,
      taxBase: 452952.38,
      taxAmount: 137047.62,
      taxes: [
        {
          taxId: iclTaxId,
          taxName: "ICL",
          dianCode: "02",
          taxTypeCode: "ICL",
          calculationMethodCode: "PER_ALCOHOL_DEGREE_VOLUME",
          taxRate: 0,
          taxBase: 40,
          taxAmount: 14400,
          isIncluded: true,
        },
        {
          taxId: advTaxId,
          taxName: "ADV",
          dianCode: "04",
          taxTypeCode: "AD_VALOREM",
          calculationMethodCode: "AD_VALOREM",
          taxRate: 0.25,
          taxBase: 400000,
          taxAmount: 100000,
          isIncluded: true,
        },
        {
          taxId: ivaTaxId,
          taxName: "IVA 5%",
          dianCode: "01",
          taxTypeCode: "VAT",
          calculationMethodCode: "PERCENTAGE",
          taxRate: 0.05,
          taxBase: 452952.38,
          taxAmount: 22647.62,
          isIncluded: true,
        },
      ],
      lineSubtotal: 452952.38,
      lineTotal: 590000,
    }),
  ]);

  await service.createOrder(createPayload());

  assert.equal(client.insertedItems[0]?.taxAmount, 137047.62);
  assert.equal(client.insertedItemTaxes.length, 3);
  assert.deepEqual(
    client.insertedItemTaxes.map((tax) => ({
      taxId: tax.taxId,
      taxName: tax.taxName,
      dianCode: tax.dianCode,
      taxAmount: tax.taxAmount,
    })),
    [
      { taxId: iclTaxId, taxName: "ICL", dianCode: "02", taxAmount: 14400 },
      { taxId: advTaxId, taxName: "ADV", dianCode: "04", taxAmount: 100000 },
      { taxId: ivaTaxId, taxName: "IVA 5%", dianCode: "01", taxAmount: 22647.62 },
    ]
  );
});

test("OrderService.createOrder persists snapshot with promotion", async () => {
  const { service, client } = buildService([
    makePreview({
      baseUnitPrice: 100,
      finalUnitPrice: 75,
      discountAmount: 25,
      discountPercent: 25,
      appliedPromotionId: ids.promotion,
      appliedPromotionName: "Promo ORDER",
      lineSubtotal: 150,
      lineTotal: 150,
    }),
  ]);

  await service.createOrder(createPayload());

  const item = client.insertedItems[0];
  assert.equal(item.price, 75);
  assert.equal(item.subtotal, 150);
  assert.equal(item.discountAmount, 25);
  assert.equal(item.discountPercent, 25);
  assert.equal(item.discountTotal, 50);
  assert.equal(item.appliedPromotionId, ids.promotion);
  assert.equal(item.appliedPromotionName, "Promo ORDER");
  assert.equal(
    (item.pricingSnapshot?.["result"] as Record<string, unknown>)
      .appliedPromotionId,
    ids.promotion
  );
});

test("OrderService.createOrder persists terminal context in audit payload and response", async () => {
  const { service, client, auditEvents } = buildService([makePreview()]);

  const result = await service.createOrder({
    ...createPayload(),
    context: {
      tenantId: ids.tenant,
      branchId: ids.branch,
      terminalId: ids.terminal,
      userId: ids.user,
      cashSessionId: ids.cashSession,
    },
  });

  assert.equal(result.branchId, ids.branch);
  assert.equal(result.terminalId, ids.terminal);
  assert.equal(result.terminalName, "Terminal QA");
  assert.equal(result.cashSessionId, ids.cashSession);
  assert.equal(client.insertedOrder?.cashSessionId, ids.cashSession);
  assert.equal((auditEvents[0] as any).after.terminalId, ids.terminal);
  assert.equal((auditEvents[0] as any).after.branchId, ids.branch);
  assert.equal((auditEvents[0] as any).after.cashSessionId, ids.cashSession);
});

test("OrderService.createOrder rejects terminal outside tenant branch", async () => {
  const { service, client, pricingService } = buildService([makePreview()], {
    terminalBranchId: ids.otherBranch,
  });

  await assert.rejects(
    () =>
      service.createOrder({
        ...createPayload(),
        context: {
          tenantId: ids.tenant,
          branchId: ids.branch,
          terminalId: ids.terminal,
          userId: ids.user,
        },
      }),
    BadRequestException
  );

  assert.equal(pricingService.calls.length, 0);
  assert.equal(client.insertedOrder, null);
  assert.equal(client.rolledBack, true);
});

test("OrderService.updateOrder recalculates draft items, replaces them, and updates total", async () => {
  const { service, client, pricingService } = buildService([
    makePreview({
      baseUnitPrice: 200,
      finalUnitPrice: 180,
      discountAmount: 20,
      discountPercent: 10,
      taxes: [
        {
          taxId: ids.tax,
          taxName: "IVA",
          dianCode: "01",
          taxTypeCode: "VAT",
          calculationMethodCode: "PERCENTAGE",
          taxRate: 0.19,
          taxBase: 302.52,
          taxAmount: 57.48,
          isIncluded: true,
        },
      ],
      lineSubtotal: 360,
      lineTotal: 360,
    }),
  ]);

  const result = await service.updateOrder(
    ids.order,
    ids.tenant,
    {
      total: 9999,
      items: [
        {
          productId: ids.product,
          orderedQuantity: 2,
          price: 1,
          subtotal: 2,
        },
      ],
    },
    actor
  );

  assert.equal(result.total, 360);
  assert.equal(client.updatedOrder?.total, 360);
  assert.equal(client.deletedItemTaxes, true);
  assert.equal(client.deletedItems, true);
  assert.equal(client.insertedItems.length, 1);
  assert.equal(client.insertedItemTaxes.length, 1);
  assert.equal(client.insertedItems[0].price, 180);
  assert.equal(client.insertedItems[0].subtotal, 360);
  assert.equal(pricingService.calls.length, 1);
});

test("OrderService.updateOrder rejects non-draft orders before pricing", async () => {
  const { service, client, pricingService } = buildService([], {
    currentStatus: "CONFIRMED",
  });

  await assert.rejects(
    () =>
      service.updateOrder(
        ids.order,
        ids.tenant,
        {
          items: [
            {
              productId: ids.product,
              quantity: 1,
              price: 1,
              subtotal: 1,
            },
          ],
        },
        actor
      ),
    BadRequestException
  );

  assert.equal(pricingService.calls.length, 0);
  assert.equal(client.insertedItems.length, 0);
  assert.equal(client.rolledBack, true);
});

test("OrderService.updateOrder rejects USER branch outside scope before pricing", async () => {
  const { service, client, pricingService } = buildService([makePreview()]);
  const scopedActor = {
    roles: ["USER"],
    tenantId: ids.tenant,
    userId: ids.user,
    branchId: ids.branch,
  };

  await assert.rejects(
    () =>
      service.updateOrder(
        ids.order,
        ids.tenant,
        {
          branchId: ids.otherBranch,
          items: [
            {
              productId: ids.product,
              quantity: 1,
              price: 1,
              subtotal: 1,
            },
          ],
        },
        scopedActor
      ),
    /No autorizado para otra sucursal/
  );

  assert.equal(pricingService.calls.length, 0);
  assert.equal(client.updatedOrder, null);
  assert.equal(client.rolledBack, true);
});

test("OrderService.createOrder without branch fails before insert", async () => {
  const { service, client, getClientCalls } = buildService([makePreview()]);

  await assert.rejects(
    () =>
      service.createOrder({
        ...createPayload(),
        branchId: undefined,
      }),
    BadRequestException
  );

  assert.equal(getClientCalls(), 0);
  assert.equal(client.insertedOrder, null);
});

test("OrderService.createOrder uses product price from PricingService instead of client payload", async () => {
  const { service, client } = buildService([
    makePreview({
      baseUnitPrice: 250,
      finalUnitPrice: 250,
      lineSubtotal: 500,
      lineTotal: 500,
    }),
  ]);

  await service.createOrder({
    ...createPayload(),
    total: 1,
    items: [
      {
        productId: ids.product,
        quantity: 2,
        price: 0.01,
        subtotal: 0.02,
      },
    ],
  });

  assert.equal(client.insertedOrder?.total, 500);
  assert.equal(client.insertedItems[0].baseUnitPrice, 250);
  assert.equal(client.insertedItems[0].finalUnitPrice, 250);
  assert.equal(client.insertedItems[0].price, 250);
  assert.equal(client.insertedItems[0].subtotal, 500);
});

test("OrderService.getOrders filters by customerId", async () => {
  const queries: RecordedQuery[] = [];
  const service = new OrderService(
    {
      query: async (text: string, params: unknown[] = []) => {
        queries.push({ text, params });
        return { rows: [] };
      },
    } as never,
    { logEvent: () => undefined } as never,
    { findAccessibleBranchIds: async () => [] } as never,
    {} as never,
    {} as never,
    {} as never
  );

  await service.getOrders(
    {
      tenantId: ids.tenant,
      customerId: ids.customer,
      cashScope: "all",
    },
    actor
  );

  assert.match(queries[0].text, /o\.customer_id = \$2::uuid/);
  assert.deepEqual(queries[0].params, [ids.tenant, ids.customer]);
});

test("OrderService.getOrders current scope filters by current cash session", async () => {
  const queries: RecordedQuery[] = [];
  const service = new OrderService(
    {
      query: async (text: string, params: unknown[] = []) => {
        queries.push({ text, params });
        if (text.includes("FROM cash_sessions")) {
          return { rows: [{ id: ids.cashSession }] };
        }
        return { rows: [] };
      },
    } as never,
    { logEvent: () => undefined } as never,
    { findAccessibleBranchIds: async () => [] } as never,
    {} as never,
    {} as never,
    {} as never
  );

  await service.getOrders(
    {
      tenantId: ids.tenant,
      cashScope: "current",
    },
    actor
  );

  const listQuery = queries.find((query) => query.text.includes("FROM orders o"));
  assert.ok(listQuery);
  assert.match(listQuery.text, /o\.cash_session_id = \$2::uuid/);
  assert.deepEqual(listQuery.params, [ids.tenant, ids.cashSession]);
});

test("OrderService.invoiceOrder rejects POS session from another order branch", async () => {
  let saleCreated = false;
  const queries: RecordedQuery[] = [];
  const service = new OrderService(
    {
      query: async (text: string, params: unknown[] = []) => {
        queries.push({ text, params });
        const sql = text.replace(/\s+/g, " ").trim();

        if (sql.includes("auditoria_eventos")) {
          return {
            rows: [
              {
                branch_id: ids.branch,
                branch_name: "Sucursal QA",
                terminal_id: ids.terminal,
                terminal_name: "Terminal QA",
              },
            ],
          };
        }

        if (sql.includes("FROM orders") && sql.includes("LIMIT 1")) {
          return {
            rows: [
              {
                id: ids.order,
                tenant_id: ids.tenant,
                customer_id: ids.customer,
                type: "CASH",
                status: "COMPLETED",
                total: 500,
                payment_status: "PENDING",
                total_paid: 0,
                balance_due: 500,
                created_at: new Date("2026-06-01T10:00:00.000Z"),
              },
            ],
          };
        }

        if (sql.includes("FROM order_items")) {
          return {
            rows: [
              {
                id: "10000000-0000-0000-0000-000000000012",
                order_id: ids.order,
                product_id: ids.product,
                product_name: "Producto QA",
                ordered_quantity: 1,
                delivered_quantity: 1,
                billed_quantity: 0,
                price: 500,
                subtotal: 500,
              },
            ],
          };
        }

        if (sql.includes("FROM payments")) {
          return { rows: [] };
        }

        throw new Error(`Unexpected SQL in invoice test: ${sql}`);
      },
    } as never,
    { logEvent: () => undefined } as never,
    { findAccessibleBranchIds: async () => [] } as never,
    {
      createSaleFromOrderDelivery: async () => {
        saleCreated = true;
        return { id: "sale-001" };
      },
    } as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.invoiceOrder(
        ids.order,
        ids.tenant,
        { type: "CASH", payments: [] },
        {
          tenantId: ids.tenant,
          branchId: ids.otherBranch,
          terminalId: ids.terminal,
          posSessionId: "10000000-0000-0000-0000-000000000013",
          userId: ids.user,
        },
        {
          roles: ["SUPER_USER"],
          tenantId: ids.tenant,
          userId: ids.user,
          branchId: ids.otherBranch,
        }
      ),
    ForbiddenException
  );

  assert.equal(saleCreated, false);
  assert.ok(queries.length >= 4);
});

// --- corregir-lotes-entrega-pedidos: consumo de lotes al entregar pedidos ---

type DeliveryBalance = {
  balance_id: string;
  lot_id: string;
  location_id: string | null;
  quantity_available: number;
};

const deliveryProductB = "10000000-0000-0000-0000-000000000013";

class FakeDeliveryClient {
  queries: RecordedQuery[] = [];
  balanceUpdates: Array<{ quantity: number; balanceId: string }> = [];
  lotLinks: Array<{ movementId: unknown; lotId: unknown; locationId: unknown; quantity: unknown }> = [];
  committed = false;
  rolledBack = false;

  constructor(
    private readonly options: {
      items: Array<{ id: string; productId: string; ordered: number; delivered?: number }>;
      lotPolicies: Record<string, { requiresLot: boolean; requiresExpiration?: boolean }>;
      balances: Record<string, DeliveryBalance[]>;
    }
  ) {}

  private itemRows() {
    return this.options.items.map((item) => ({
      id: item.id,
      order_id: ids.order,
      product_id: item.productId,
      ordered_quantity: item.ordered,
      delivered_quantity: item.delivered ?? 0,
      billed_quantity: 0,
      price: 100,
      subtotal: 100 * item.ordered,
      base_unit_price: 100,
      final_unit_price: 100,
      discount_amount: 0,
      discount_percent: 0,
      discount_total: 0,
      applied_promotion_id: null,
      applied_promotion_name: null,
      tax_id: null,
      tax_rate: 0,
      tax_base: 0,
      tax_amount: 0,
      line_total: 100 * item.ordered,
      pricing_snapshot: null,
      pricing_calculated_at: null,
    }));
  }

  async query<T>(text: string, params: unknown[] = []) {
    this.queries.push({ text, params });
    const sql = text.replace(/\s+/g, " ").trim();

    if (sql === "BEGIN") {
      return { rows: [] as T[] };
    }
    if (sql === "COMMIT") {
      this.committed = true;
      return { rows: [] as T[] };
    }
    if (sql === "ROLLBACK") {
      this.rolledBack = true;
      return { rows: [] as T[] };
    }
    if (sql.includes("auditoria_eventos")) {
      return {
        rows: [
          { branch_id: ids.branch, branch_name: "Sucursal QA", terminal_id: null, terminal_name: null },
        ] as T[],
      };
    }
    if (sql.includes("FROM orders") && sql.includes("LIMIT 1")) {
      return {
        rows: [
          {
            id: ids.order,
            tenant_id: ids.tenant,
            customer_id: ids.customer,
            type: "CASH",
            status: "CONFIRMED",
            total: 500,
            payment_status: "PAID",
            total_paid: 500,
            balance_due: 0,
            created_at: new Date("2026-11-13T10:00:00.000Z"),
          },
        ] as T[],
      };
    }
    if (sql.includes("inventory_lock_stock_scope")) {
      return { rows: [{}] as T[] };
    }
    if (sql.includes("requires_lot") && sql.includes("FROM products")) {
      const productIds = params[1] as string[];
      return {
        rows: productIds
          .filter((productId) => this.options.lotPolicies[productId])
          .map((productId) => ({
            id: productId,
            requires_lot: this.options.lotPolicies[productId].requiresLot,
            requires_expiration: this.options.lotPolicies[productId].requiresExpiration ?? false,
          })) as T[],
      };
    }
    if (sql.includes("FROM inventory_lot_balances balance")) {
      return { rows: (this.options.balances[params[2] as string] ?? []) as T[] };
    }
    if (sql.startsWith("UPDATE inventory_lot_balances")) {
      this.balanceUpdates.push({ quantity: Number(params[0]), balanceId: String(params[1]) });
      return { rows: [{ id: params[1] }] as T[] };
    }
    if (sql.startsWith("INSERT INTO stock_movement_lots")) {
      this.lotLinks.push({
        movementId: params[1],
        lotId: params[3],
        locationId: params[4],
        quantity: params[5],
      });
      return { rows: [] as T[] };
    }
    if (sql.startsWith("UPDATE order_items")) {
      return { rows: [] as T[] };
    }
    if (sql.includes("FROM order_items")) {
      return { rows: this.itemRows() as T[] };
    }
    if (sql.startsWith("UPDATE orders")) {
      return {
        rows: [
          {
            id: ids.order,
            tenant_id: ids.tenant,
            customer_id: ids.customer,
            type: "CASH",
            status: params[2],
            total: 500,
            payment_status: "PAID",
            total_paid: 500,
            balance_due: 0,
            created_at: new Date("2026-11-13T10:00:00.000Z"),
          },
        ] as T[],
      };
    }
    throw new Error(`Unexpected SQL in delivery test: ${sql}`);
  }

  release() {}
}

const buildDeliveryService = (
  clientOptions: ConstructorParameters<typeof FakeDeliveryClient>[0],
  kardexStock = 100
) => {
  const client = new FakeDeliveryClient(clientOptions);
  const movements: Array<{ id: string; productId: string; quantity: number }> = [];
  const stockMovementService = {
    getStockByProduct: async () => ({ stock: kardexStock }),
    createMovement: async (data: { productId: string; quantity: number }) => {
      const movement = { id: `movement-${movements.length + 1}`, productId: data.productId, quantity: data.quantity };
      movements.push(movement);
      return movement;
    },
    logMovementAuditEvent: () => undefined,
  };
  const service = new OrderService(
    { getClient: async () => client as unknown as PoolClient } as never,
    { logEvent: () => undefined } as never,
    { findAccessibleBranchIds: async () => [] } as never,
    {} as never,
    stockMovementService as never,
    {} as never
  );
  return { service, client, movements };
};

const deliveryContext = { userId: ids.user, branchId: ids.branch };

test("OrderService.deliverOrder: producto con lote consume un lote por FEFO y crea el vínculo", async () => {
  const { service, client, movements } = buildDeliveryService({
    items: [{ id: "10000000-0000-0000-0000-0000000000a1", productId: ids.product, ordered: 3 }],
    lotPolicies: { [ids.product]: { requiresLot: true } },
    balances: {
      [ids.product]: [{ balance_id: "balance-1", lot_id: "lot-1", location_id: "loc-1", quantity_available: 5 }],
    },
  });

  await service.deliverOrder(ids.order, ids.tenant, [{ productId: ids.product, quantity: 3 }], deliveryContext, actor);

  assert.equal(client.committed, true);
  assert.equal(movements.length, 1);
  assert.deepEqual(client.balanceUpdates, [{ quantity: 3, balanceId: "balance-1" }]);
  assert.deepEqual(client.lotLinks, [
    { movementId: "movement-1", lotId: "lot-1", locationId: "loc-1", quantity: 3 },
  ]);
});

test("OrderService.deliverOrder: reparte la entrega entre varios lotes en orden FEFO", async () => {
  const { service, client } = buildDeliveryService({
    items: [{ id: "10000000-0000-0000-0000-0000000000a1", productId: ids.product, ordered: 7 }],
    lotPolicies: { [ids.product]: { requiresLot: true } },
    balances: {
      [ids.product]: [
        { balance_id: "balance-1", lot_id: "lot-1", location_id: null, quantity_available: 5 },
        { balance_id: "balance-2", lot_id: "lot-2", location_id: null, quantity_available: 4 },
      ],
    },
  });

  await service.deliverOrder(ids.order, ids.tenant, [{ productId: ids.product, quantity: 7 }], deliveryContext, actor);

  assert.deepEqual(client.balanceUpdates, [
    { quantity: 5, balanceId: "balance-1" },
    { quantity: 2, balanceId: "balance-2" },
  ]);
  assert.equal(client.lotLinks.length, 2);
  const lotQuery = client.queries.find((query) => query.text.includes("FROM inventory_lot_balances balance"));
  const lotSql = lotQuery?.text.replace(/\s+/g, " ") ?? "";
  assert.match(lotSql, /lot\.status = 'ACTIVE'/);
  assert.match(lotSql, /lot\.expiration_date IS NULL OR lot\.expiration_date >= CURRENT_DATE/);
  assert.match(lotSql, /ORDER BY lot\.expiration_date ASC NULLS LAST, lot\.received_at ASC/);
  assert.match(lotSql, /FOR UPDATE OF balance/);
});

test("OrderService.deliverOrder: rechaza sin efectos si los lotes vendibles no alcanzan", async () => {
  const { service, client } = buildDeliveryService(
    {
      items: [{ id: "10000000-0000-0000-0000-0000000000a1", productId: ids.product, ordered: 5 }],
      lotPolicies: { [ids.product]: { requiresLot: true } },
      balances: {
        [ids.product]: [{ balance_id: "balance-1", lot_id: "lot-1", location_id: null, quantity_available: 2 }],
      },
    },
    10
  );

  await assert.rejects(
    () => service.deliverOrder(ids.order, ids.tenant, [{ productId: ids.product, quantity: 5 }], deliveryContext, actor),
    /insufficient lot stock for delivery/
  );
  assert.equal(client.rolledBack, true);
  assert.equal(client.committed, false);
  assert.equal(client.balanceUpdates.length, 0);
  assert.equal(client.lotLinks.length, 0);
});

test("OrderService.deliverOrder: producto sin lote conserva el flujo y no toca lotes", async () => {
  const { service, client, movements } = buildDeliveryService({
    items: [{ id: "10000000-0000-0000-0000-0000000000a1", productId: ids.product, ordered: 2 }],
    lotPolicies: { [ids.product]: { requiresLot: false } },
    balances: {},
  });

  await service.deliverOrder(ids.order, ids.tenant, [{ productId: ids.product, quantity: 2 }], deliveryContext, actor);

  assert.equal(client.committed, true);
  assert.equal(movements.length, 1);
  assert.equal(
    client.queries.some((query) => query.text.includes("inventory_lot_balances")),
    false
  );
  assert.equal(client.lotLinks.length, 0);
});

test("OrderService.deliverOrder: bloquea el alcance de stock en orden ascendente antes de consumir lotes", async () => {
  const { service, client } = buildDeliveryService({
    items: [
      { id: "10000000-0000-0000-0000-0000000000a1", productId: deliveryProductB, ordered: 1 },
      { id: "10000000-0000-0000-0000-0000000000a2", productId: ids.product, ordered: 1 },
    ],
    lotPolicies: {
      [ids.product]: { requiresLot: true },
      [deliveryProductB]: { requiresLot: true },
    },
    balances: {
      [ids.product]: [{ balance_id: "balance-a", lot_id: "lot-a", location_id: null, quantity_available: 1 }],
      [deliveryProductB]: [{ balance_id: "balance-b", lot_id: "lot-b", location_id: null, quantity_available: 1 }],
    },
  });

  await service.deliverOrder(
    ids.order,
    ids.tenant,
    [
      { productId: deliveryProductB, quantity: 1 },
      { productId: ids.product, quantity: 1 },
    ],
    deliveryContext,
    actor
  );

  const lockCalls = client.queries.filter((query) => query.text.includes("inventory_lock_stock_scope"));
  assert.deepEqual(
    lockCalls.map((query) => query.params[2]),
    [ids.product, deliveryProductB].sort()
  );
  const firstLotQueryIndex = client.queries.findIndex((query) =>
    query.text.includes("FROM inventory_lot_balances balance")
  );
  const lastLockIndex = client.queries.lastIndexOf(lockCalls[lockCalls.length - 1]);
  assert.ok(lastLockIndex < firstLotQueryIndex);
  assert.deepEqual(lockCalls[0].params.slice(0, 2), [ids.tenant, ids.branch]);
});
type DeliveryIdempotencyRow = {
  request_hash: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  result: unknown;
  operation_reference: string | null;
};

class FakeIdempotentDeliveryClient extends FakeDeliveryClient {
  idempotencyRows = new Map<string, DeliveryIdempotencyRow>();

  async query<T>(text: string, params: unknown[] = []) {
    const sql = text.replace(/\s+/g, " ").trim();
    if (sql.startsWith("INSERT INTO order_delivery_idempotency")) {
      this.queries.push({ text, params });
      const key = `${params[0]}:${params[1]}:${params[2]}`;
      if (this.idempotencyRows.has(key)) {
        return { rows: [] as T[] };
      }
      const row: DeliveryIdempotencyRow = {
        request_hash: String(params[3]),
        status: "PENDING",
        result: null,
        operation_reference: null,
      };
      this.idempotencyRows.set(key, row);
      return { rows: [row] as T[] };
    }
    if (sql.includes("FROM order_delivery_idempotency")) {
      this.queries.push({ text, params });
      const row = this.idempotencyRows.get(`${params[0]}:${params[1]}:${params[2]}`);
      return { rows: (row ? [row] : []) as T[] };
    }
    if (sql.startsWith("UPDATE order_delivery_idempotency")) {
      this.queries.push({ text, params });
      const row = this.idempotencyRows.get(`${params[0]}:${params[1]}:${params[2]}`);
      if (!row || row.status !== "PENDING" || row.request_hash !== params[5]) {
        return { rows: [] as T[], rowCount: 0 };
      }
      row.status = "COMPLETED";
      row.result = JSON.parse(String(params[3]));
      row.operation_reference = String(params[4]);
      return { rows: [] as T[], rowCount: 1 };
    }
    return super.query<T>(text, params);
  }
}

const buildIdempotentDeliveryService = () => {
  const client = new FakeIdempotentDeliveryClient({
    items: [{ id: "10000000-0000-0000-0000-0000000000a1", productId: ids.product, ordered: 10 }],
    lotPolicies: { [ids.product]: { requiresLot: false } },
    balances: {},
  });
  const movements: Array<{ id: string; productId: string; quantity: number }> = [];
  const stockMovementService = {
    getStockByProduct: async () => ({ stock: 100 }),
    createMovement: async (data: { productId: string; quantity: number }) => {
      const movement = { id: `movement-${movements.length + 1}`, productId: data.productId, quantity: data.quantity };
      movements.push(movement);
      return movement;
    },
    logMovementAuditEvent: () => undefined,
  };
  const service = new OrderService(
    { getClient: async () => client as unknown as PoolClient } as never,
    { logEvent: () => undefined } as never,
    { findAccessibleBranchIds: async () => [] } as never,
    {} as never,
    stockMovementService as never,
    {} as never
  );
  return { service, client, movements };
};

test("OrderService.deliverOrder: bloquea la fila del pedido antes de leer los ítems pendientes", async () => {
  const { service, client } = buildDeliveryService({
    items: [{ id: "10000000-0000-0000-0000-0000000000a1", productId: ids.product, ordered: 2 }],
    lotPolicies: { [ids.product]: { requiresLot: false } },
    balances: {},
  });

  await service.deliverOrder(ids.order, ids.tenant, [{ productId: ids.product, quantity: 2 }], deliveryContext, actor);

  const orderQueryIndex = client.queries.findIndex((query) => {
    const sql = query.text.replace(/\s+/g, " ");
    return sql.includes("FROM orders") && sql.includes("LIMIT 1");
  });
  const itemsQueryIndex = client.queries.findIndex((query) => query.text.includes("FROM order_items"));
  assert.match(client.queries[orderQueryIndex].text.replace(/\s+/g, " "), /LIMIT 1 FOR UPDATE/);
  assert.ok(orderQueryIndex < itemsQueryIndex);
});

test("OrderService.deliverOrder: el reintento con la misma Idempotency-Key devuelve el resultado sin volver a entregar", async () => {
  const { service, client, movements } = buildIdempotentDeliveryService();
  const items = [{ productId: ids.product, quantity: 5 }];

  const first = await service.deliverOrder(ids.order, ids.tenant, items, deliveryContext, actor, "delivery-key-1");
  const second = await service.deliverOrder(ids.order, ids.tenant, items, deliveryContext, actor, "delivery-key-1");

  assert.equal(movements.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(second)), JSON.parse(JSON.stringify(first)));
  assert.equal(client.queries.filter((query) => query.text.startsWith("UPDATE order_items") || query.text.trim().startsWith("UPDATE order_items")).length, 1);
  const [row] = [...client.idempotencyRows.values()];
  assert.equal(row.status, "COMPLETED");
  assert.equal(row.operation_reference, `order-delivery:${ids.order}:delivery-key-1`);
});

test("OrderService.deliverOrder: la misma Idempotency-Key con otro contenido responde conflicto sin efectos", async () => {
  const { service, movements } = buildIdempotentDeliveryService();

  await service.deliverOrder(ids.order, ids.tenant, [{ productId: ids.product, quantity: 5 }], deliveryContext, actor, "delivery-key-2");
  await assert.rejects(
    () => service.deliverOrder(ids.order, ids.tenant, [{ productId: ids.product, quantity: 3 }], deliveryContext, actor, "delivery-key-2"),
    /Idempotency-Key was already used with a different payload/
  );
  assert.equal(movements.length, 1);
});

test("OrderService.deliverOrder: rechaza una Idempotency-Key inválida antes de abrir la transacción", async () => {
  const { service, client } = buildIdempotentDeliveryService();

  await assert.rejects(
    () => service.deliverOrder(ids.order, ids.tenant, [{ productId: ids.product, quantity: 1 }], deliveryContext, actor, "clave con espacios"),
    /Idempotency-Key is invalid/
  );
  assert.equal(client.queries.length, 0);
});
