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
};

type RecordedQuery = {
  text: string;
  params: unknown[];
};

type InsertedOrder = {
  total: number;
  balanceDue: number;
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
  insertedOrder: InsertedOrder | null = null;
  updatedOrder: InsertedOrder | null = null;
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
        total: Number(params[5]),
        balanceDue: Number(params[8]),
      };
      return {
        rows: [
          {
            id: params[0],
            tenant_id: params[1],
            customer_id: params[2],
            type: params[3],
            status: params[4],
            total: params[5],
            payment_status: params[6],
            total_paid: params[7],
            balance_due: params[8],
            created_at: params[9],
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
  const { service, auditEvents } = buildService([makePreview()]);

  const result = await service.createOrder({
    ...createPayload(),
    context: {
      tenantId: ids.tenant,
      branchId: ids.branch,
      terminalId: ids.terminal,
      userId: ids.user,
    },
  });

  assert.equal(result.branchId, ids.branch);
  assert.equal(result.terminalId, ids.terminal);
  assert.equal(result.terminalName, "Terminal QA");
  assert.equal((auditEvents[0] as any).after.terminalId, ids.terminal);
  assert.equal((auditEvents[0] as any).after.branchId, ids.branch);
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
  assert.equal(client.deletedItems, true);
  assert.equal(client.insertedItems.length, 1);
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
    },
    actor
  );

  assert.match(queries[0].text, /o\.customer_id = \$2::uuid/);
  assert.deepEqual(queries[0].params, [ids.tenant, ids.customer]);
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
