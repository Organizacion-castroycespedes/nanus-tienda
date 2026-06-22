import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { DeliveriesService } from "./deliveries.service";
import { DeliveryStateMachineService } from "./services/delivery-state-machine.service";

const tenantId = "00000000-0000-0000-0000-000000000001";
const branchId = "00000000-0000-0000-0000-000000000002";
const actorUserId = "00000000-0000-0000-0000-000000000003";
const courierId = "00000000-0000-0000-0000-000000000004";
const deliveryId = "00000000-0000-0000-0000-000000000005";
const orderId = "00000000-0000-0000-0000-000000000006";
const customerId = "00000000-0000-0000-0000-000000000007";

const actor = {
  tenantId,
  userId: actorUserId,
  roles: ["ADMIN"],
};

const buildDelivery = (overrides: Record<string, unknown> = {}) => ({
  id: deliveryId,
  tenant_id: tenantId,
  branch_id: branchId,
  customer_id: null,
  order_id: null,
  sale_id: null,
  delivery_number: "DOM-TEST",
  status: "CREATED",
  customer_name: "Cliente prueba",
  customer_phone: "3000000000",
  delivery_address: "Calle prueba 123",
  delivery_reference: null,
  delivery_fee: "0",
  subtotal: "0",
  total: "0",
  payment_method_id: null,
  assigned_courier_id: null,
  notes: null,
  metadata: {},
  created_by_user_id: actorUserId,
  updated_by_user_id: actorUserId,
  created_at: "2026-06-20T00:00:00.000Z",
  updated_at: "2026-06-20T00:00:00.000Z",
  dispatched_at: null,
  cancelled_at: null,
  delivered_at: null,
  failed_at: null,
  ...overrides,
});

const buildOrderSource = (overrides: Record<string, unknown> = {}) => ({
  id: orderId,
  tenant_id: tenantId,
  customer_id: customerId,
  order_total: "12500.00",
  customer_name: "Cliente pedido",
  customer_phone: "3111111111",
  customer_address: "Calle pedido 45",
  branch_id: branchId,
  ...overrides,
});

const buildSaleSource = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-0000-0000-000000000008",
  tenant_id: tenantId,
  branch_id: branchId,
  customer_id: customerId,
  order_id: orderId,
  total: "12500.00",
  customer_name: "Cliente factura",
  customer_phone: "3222222222",
  customer_address: "Carrera factura 99",
  ...overrides,
});

const buildHarness = (initialDelivery: Record<string, unknown>) => {
  const queries: string[] = [];
  const historyParams: unknown[][] = [];
  let released = false;
  let rolledBack = false;
  let committed = false;

  const client = {
    query: async (queryText: string, params: unknown[] = []) => {
      queries.push(queryText);

      if (queryText === "BEGIN") {
        return { rows: [] };
      }
      if (queryText === "COMMIT") {
        committed = true;
        return { rows: [] };
      }
      if (queryText === "ROLLBACK") {
        rolledBack = true;
        return { rows: [] };
      }
      if (queryText.includes("FROM public.deliveries") && queryText.includes("FOR UPDATE")) {
        return { rows: [initialDelivery] };
      }
      if (queryText.includes("UPDATE public.deliveries")) {
        const nextStatus = params[0] as string;
        const updated = {
          ...initialDelivery,
          status: nextStatus,
          updated_by_user_id: params[1],
          assigned_courier_id:
            queryText.includes("assigned_courier_id =")
              ? params[2]
              : initialDelivery.assigned_courier_id,
          dispatched_at:
            queryText.includes("dispatched_at =")
              ? params[2]
              : initialDelivery.dispatched_at,
          delivered_at:
            queryText.includes("delivered_at =")
              ? params[2]
              : initialDelivery.delivered_at,
          cancelled_at:
            queryText.includes("cancelled_at =")
              ? params[2]
              : initialDelivery.cancelled_at,
          failed_at:
            queryText.includes("failed_at =")
              ? params[2]
              : initialDelivery.failed_at,
        };
        return { rows: [updated] };
      }
      if (queryText.includes("INSERT INTO public.delivery_status_history")) {
        historyParams.push(params);
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${queryText}`);
    },
    release: () => {
      released = true;
    },
  };

  const db = {
    query: async () => ({ rows: [{ id: courierId }] }),
    getClient: async () => client,
  };

  const service = new DeliveriesService(
    db as never,
    {} as never,
    new DeliveryStateMachineService()
  );

  return {
    service,
    get committed() {
      return committed;
    },
    get rolledBack() {
      return rolledBack;
    },
    get released() {
      return released;
    },
    historyParams,
    queries,
  };
};

const buildOrderCreateHarness = (options: {
  order?: Record<string, unknown> | null;
  duplicate?: Record<string, unknown> | null;
} = {}) => {
  const order = options.order === undefined ? buildOrderSource() : options.order;
  const duplicate = options.duplicate ?? null;
  const queries: string[] = [];
  const historyParams: unknown[][] = [];
  let released = false;
  let rolledBack = false;
  let committed = false;

  const client = {
    query: async (queryText: string, params: unknown[] = []) => {
      queries.push(queryText);

      if (queryText === "BEGIN") {
        return { rows: [] };
      }
      if (queryText === "COMMIT") {
        committed = true;
        return { rows: [] };
      }
      if (queryText === "ROLLBACK") {
        rolledBack = true;
        return { rows: [] };
      }
      if (queryText.includes("FROM public.orders") && queryText.includes("FOR UPDATE")) {
        return { rows: order && params[1] === tenantId ? [{ id: order.id }] : [] };
      }
      if (queryText.includes("FROM public.deliveries") && queryText.includes("order_id")) {
        return { rows: duplicate ? [duplicate] : [] };
      }
      if (queryText.includes("INSERT INTO public.deliveries")) {
        return {
          rows: [
            buildDelivery({
              id: deliveryId,
              tenant_id: params[0],
              branch_id: params[1],
              customer_id: params[2],
              order_id: params[3],
              sale_id: params[4],
              delivery_number: params[5],
              status: "CREATED",
              customer_name: params[6],
              customer_phone: params[7],
              delivery_address: params[8],
              delivery_reference: params[9],
              delivery_fee: params[10],
              subtotal: params[11],
              total: params[12],
              payment_method_id: params[13],
              notes: params[14],
              metadata: JSON.parse(String(params[15])),
              created_by_user_id: params[16],
              updated_by_user_id: params[16],
            }),
          ],
        };
      }
      if (queryText.includes("INSERT INTO public.delivery_status_history")) {
        historyParams.push(params);
        return { rows: [] };
      }

      throw new Error(`Unexpected client query: ${queryText}`);
    },
    release: () => {
      released = true;
    },
  };

  const db = {
    query: async (queryText: string, params: unknown[] = []) => {
      queries.push(queryText);

      if (queryText.includes("FROM public.orders o")) {
        return { rows: order && params[1] === tenantId ? [order] : [] };
      }
      if (queryText.includes("FROM public.tenant_branches")) {
        return { rows: params[0] === branchId && params[1] === tenantId ? [{ id: branchId }] : [] };
      }
      if (queryText.includes("FROM public.customers")) {
        return { rows: params[0] === customerId && params[1] === tenantId ? [{ id: customerId }] : [] };
      }
      if (queryText.includes("FROM public.orders")) {
        return { rows: order && params[1] === tenantId ? [{ id: order.id }] : [] };
      }
      if (queryText.includes("FROM public.payment_methods")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected db query: ${queryText}`);
    },
    getClient: async () => client,
  };

  const service = new DeliveriesService(
    db as never,
    { generate: async () => "DOM-ORDER" } as never,
    new DeliveryStateMachineService()
  );

  return {
    service,
    get committed() {
      return committed;
    },
    get rolledBack() {
      return rolledBack;
    },
    get released() {
      return released;
    },
    historyParams,
    queries,
  };
};

const buildSaleCreateHarness = (options: {
  sale?: Record<string, unknown> | null;
  duplicate?: Record<string, unknown> | null;
} = {}) => {
  const sale = options.sale === undefined ? buildSaleSource() : options.sale;
  const duplicate = options.duplicate ?? null;
  const queries: string[] = [];
  const historyParams: unknown[][] = [];
  let released = false;
  let rolledBack = false;
  let committed = false;

  const client = {
    query: async (queryText: string, params: unknown[] = []) => {
      queries.push(queryText);

      if (queryText === "BEGIN") {
        return { rows: [] };
      }
      if (queryText === "COMMIT") {
        committed = true;
        return { rows: [] };
      }
      if (queryText === "ROLLBACK") {
        rolledBack = true;
        return { rows: [] };
      }
      if (
        queryText.includes("SELECT id, branch_id") &&
        queryText.includes("FROM public.sales")
      ) {
        return { rows: sale && params[1] === tenantId ? [{ id: sale.id, branch_id: sale.branch_id }] : [] };
      }
      if (queryText.includes("FROM public.sales") && queryText.includes("FOR UPDATE")) {
        return { rows: sale && params[1] === tenantId ? [{ id: sale.id }] : [] };
      }
      if (queryText.includes("FROM public.orders") && queryText.includes("FOR UPDATE")) {
        return {
          rows:
            sale && params[1] === tenantId && sale.order_id
              ? [{ id: sale.order_id }]
              : [],
        };
      }
      if (queryText.includes("FROM public.deliveries") && queryText.includes("order_id")) {
        return { rows: duplicate ? [duplicate] : [] };
      }
      if (queryText.includes("FROM public.deliveries") && queryText.includes("sale_id")) {
        return { rows: duplicate ? [duplicate] : [] };
      }
      if (queryText.includes("INSERT INTO public.deliveries")) {
        return {
          rows: [
            buildDelivery({
              id: deliveryId,
              tenant_id: params[0],
              branch_id: params[1],
              customer_id: params[2],
              order_id: params[3],
              sale_id: params[4],
              delivery_number: params[5],
              status: "CREATED",
              customer_name: params[6],
              customer_phone: params[7],
              delivery_address: params[8],
              delivery_reference: params[9],
              delivery_fee: params[10],
              subtotal: params[11],
              total: params[12],
              payment_method_id: params[13],
              notes: params[14],
              metadata: JSON.parse(String(params[15])),
              created_by_user_id: params[16],
              updated_by_user_id: params[16],
            }),
          ],
        };
      }
      if (queryText.includes("INSERT INTO public.delivery_status_history")) {
        historyParams.push(params);
        return { rows: [] };
      }

      throw new Error(`Unexpected client query: ${queryText}`);
    },
    release: () => {
      released = true;
    },
  };

  const db = {
    query: async (queryText: string, params: unknown[] = []) => {
      queries.push(queryText);

      if (queryText.includes("FROM public.sales s")) {
        return { rows: sale && params[1] === tenantId ? [sale] : [] };
      }
      if (queryText.includes("SELECT id, branch_id") && queryText.includes("FROM public.sales")) {
        return { rows: sale && params[1] === tenantId ? [{ id: sale.id, branch_id: sale.branch_id }] : [] };
      }
      if (queryText.includes("FROM public.tenant_branches")) {
        return { rows: params[0] === branchId && params[1] === tenantId ? [{ id: branchId }] : [] };
      }
      if (queryText.includes("FROM public.customers")) {
        return { rows: params[0] === customerId && params[1] === tenantId ? [{ id: customerId }] : [] };
      }
      if (queryText.includes("FROM public.orders")) {
        return { rows: params[0] === orderId && params[1] === tenantId ? [{ id: orderId }] : [] };
      }
      if (queryText.includes("FROM public.payment_methods")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected db query: ${queryText}`);
    },
    getClient: async () => client,
  };

  const service = new DeliveriesService(
    db as never,
    { generate: async () => "DOM-SALE" } as never,
    new DeliveryStateMachineService()
  );

  return {
    service,
    get committed() {
      return committed;
    },
    get rolledBack() {
      return rolledBack;
    },
    get released() {
      return released;
    },
    historyParams,
    queries,
  };
};

const buildOrderLookupHarness = (options: {
  order?: Record<string, unknown> | null;
  delivery?: Record<string, unknown> | null;
} = {}) => {
  const order = options.order === undefined ? buildOrderSource() : options.order;
  const delivery =
    options.delivery === undefined
      ? buildDelivery({ order_id: orderId, customer_id: customerId })
      : options.delivery;
  const queries: string[] = [];
  const db = {
    query: async (queryText: string, params: unknown[] = []) => {
      queries.push(queryText);

      if (queryText.includes("FROM public.orders o")) {
        return { rows: order && params[1] === tenantId ? [order] : [] };
      }
      if (queryText.includes("FROM public.deliveries")) {
        return { rows: delivery ? [delivery] : [] };
      }

      throw new Error(`Unexpected db query: ${queryText}`);
    },
  };

  return {
    service: new DeliveriesService(
      db as never,
      {} as never,
      new DeliveryStateMachineService()
    ),
    queries,
  };
};

test("DeliveriesService.assign prepares delivery and writes history transactionally", async () => {
  const harness = buildHarness(buildDelivery());

  const result = await harness.service.assign(
    deliveryId,
    {},
    actor
  );

  assert.equal(result.status, "EN_PREPARACION");
  assert.equal(result.assigned_courier_id, null);
  assert.equal(harness.committed, true);
  assert.equal(harness.rolledBack, false);
  assert.equal(harness.released, true);
  assert.equal(harness.historyParams.length, 1);
  assert.deepEqual(harness.historyParams[0].slice(0, 5), [
    deliveryId,
    "CREATED",
    "ASSIGNED",
    actorUserId,
    null,
  ]);
});

test("DeliveriesService dispatch delivered not-delivered and cancel valid flows", async () => {
  const directDispatch = buildHarness(buildDelivery());
  const directDispatchResult = await directDispatch.service.dispatch(
    deliveryId,
    {},
    actor
  );
  assert.equal(directDispatchResult.status, "DESPACHADO");
  assert.ok(directDispatchResult.dispatched_at);
  assert.equal(directDispatch.historyParams[0][2], "DISPATCHED");

  const assigned = buildHarness(
    buildDelivery({ status: "ASSIGNED" })
  );
  const dispatched = await assigned.service.dispatch(deliveryId, {}, actor);
  assert.equal(dispatched.status, "DESPACHADO");
  assert.ok(dispatched.dispatched_at);
  assert.equal(assigned.historyParams[0][2], "DISPATCHED");

  const delivered = buildHarness(
    buildDelivery({ status: "DISPATCHED" })
  );
  const deliveredResult = await delivered.service.markDelivered(
    deliveryId,
    { received_by: "Cliente prueba" },
    actor
  );
  assert.equal(deliveredResult.status, "ENTREGADO");
  assert.equal(delivered.historyParams[0][2], "DELIVERED");

  const notDelivered = buildHarness(
    buildDelivery({ status: "DISPATCHED" })
  );
  const notDeliveredResult = await notDelivered.service.markNotDelivered(
    deliveryId,
    { reason: "No estaba en casa" },
    actor
  );
  assert.equal(notDeliveredResult.status, "NO_ENTREGADO");
  assert.ok(notDeliveredResult.failed_at);
  assert.equal(notDelivered.historyParams[0][4], "No estaba en casa");

  const cancel = buildHarness(buildDelivery());
  const cancelResult = await cancel.service.cancel(
    deliveryId,
    { reason: "Cliente cancela" },
    actor
  );
  assert.equal(cancelResult.status, "CANCELADO");
  assert.equal(cancel.historyParams[0][4], "Cliente cancela");

  const retry = buildHarness(buildDelivery({ status: "NOT_DELIVERED" }));
  const retryResult = await retry.service.dispatch(deliveryId, {}, actor);
  assert.equal(retryResult.status, "DESPACHADO");
});

test("DeliveriesService rejects invalid state changes and rolls back", async () => {
  const retryBlocked = buildHarness(
    buildDelivery({ status: "NOT_DELIVERED", metadata: { retry_allowed: false } })
  );
  await assert.rejects(
    () => retryBlocked.service.dispatch(deliveryId, {}, actor),
    BadRequestException
  );
  assert.equal(retryBlocked.committed, false);
  assert.equal(retryBlocked.rolledBack, true);
  assert.equal(retryBlocked.historyParams.length, 0);

  const deliveredWithoutDispatch = buildHarness(
    buildDelivery({ status: "ASSIGNED" })
  );
  await assert.rejects(
    () => deliveredWithoutDispatch.service.markDelivered(deliveryId, {}, actor),
    BadRequestException
  );
  assert.equal(deliveredWithoutDispatch.rolledBack, true);
  assert.equal(deliveredWithoutDispatch.historyParams.length, 0);

  const cancelDelivered = buildHarness(
    buildDelivery({ status: "DELIVERED" })
  );
  await assert.rejects(
    () => cancelDelivered.service.cancel(deliveryId, { reason: "No" }, actor),
    BadRequestException
  );
  assert.equal(cancelDelivered.rolledBack, true);
  assert.equal(cancelDelivered.historyParams.length, 0);
});

test("DeliveriesService.createFromOrder creates CREADO delivery with order snapshot", async () => {
  const harness = buildOrderCreateHarness();

  const result = await harness.service.createFromOrder(
    orderId,
    { delivery_fee: 1500 },
    actor
  );

  assert.equal(result.status, "CREADO");
  assert.equal(result.order_id, orderId);
  assert.equal(result.customer_id, customerId);
  assert.equal(result.customer_name, "Cliente pedido");
  assert.equal(result.customer_phone, "3111111111");
  assert.equal(result.delivery_address, "Calle pedido 45");
  assert.equal(result.delivery_fee, 1500);
  assert.equal(result.total, 12500);
  assert.equal(result.metadata.source, "order");
  assert.equal(result.metadata.source_order_id, orderId);
  assert.equal(harness.committed, true);
  assert.equal(harness.rolledBack, false);
  assert.equal(harness.released, true);
  assert.equal(harness.historyParams.length, 1);
  assert.deepEqual(harness.historyParams[0].slice(0, 5), [
    deliveryId,
    null,
    "CREATED",
    actorUserId,
    null,
  ]);
});

test("DeliveriesService.createFromOrder rejects missing order or wrong tenant", async () => {
  const missingOrder = buildOrderCreateHarness({ order: null });
  await assert.rejects(
    () => missingOrder.service.createFromOrder(orderId, {}, actor),
    NotFoundException
  );

  const otherTenant = buildOrderCreateHarness();
  await assert.rejects(
    () =>
      otherTenant.service.createFromOrder(orderId, {}, {
        ...actor,
        tenantId: "00000000-0000-0000-0000-000000000099",
      }),
    NotFoundException
  );
});

test("DeliveriesService.createFromOrder rejects second delivery for order", async () => {
  const harness = buildOrderCreateHarness({
    duplicate: buildDelivery({ order_id: orderId, status: "DELIVERED" }),
  });

  await assert.rejects(
    () => harness.service.createFromOrder(orderId, {}, actor),
    BadRequestException
  );

  assert.equal(harness.committed, false);
  assert.equal(harness.rolledBack, true);
  assert.equal(harness.historyParams.length, 0);
});

test("DeliveriesService.createFromOrder requires address when order lacks snapshot", async () => {
  const harness = buildOrderCreateHarness({
    order: buildOrderSource({ customer_address: null }),
  });

  await assert.rejects(
    () => harness.service.createFromOrder(orderId, {}, actor),
    BadRequestException
  );
});

test("DeliveriesService.getByOrder returns delivery by tenant-scoped order", async () => {
  const harness = buildOrderLookupHarness();

  const result = await harness.service.getByOrder(orderId, actor);

  assert.ok(result);
  assert.equal(result.order_id, orderId);
  assert.equal(result.customer_id, customerId);
});

test("DeliveriesService order integration does not touch invoice or cash tables", async () => {
  const harness = buildOrderCreateHarness();

  await harness.service.createFromOrder(orderId, {}, actor);

  const joinedQueries = harness.queries.join("\n").toLowerCase();
  assert.equal(joinedQueries.includes("cash_session"), false);
  assert.equal(joinedQueries.includes("invoice"), false);
});

test("DeliveriesService.createFromSale creates CREADO delivery with sale snapshot", async () => {
  const harness = buildSaleCreateHarness();

  const result = await harness.service.createFromSale(
    "00000000-0000-0000-0000-000000000008",
    { delivery_fee: 0 },
    actor
  );

  assert.equal(result.status, "CREADO");
  assert.equal(result.sale_id, "00000000-0000-0000-0000-000000000008");
  assert.equal(result.order_id, orderId);
  assert.equal(result.customer_id, customerId);
  assert.equal(result.customer_name, "Cliente factura");
  assert.equal(result.customer_phone, "3222222222");
  assert.equal(result.delivery_address, "Carrera factura 99");
  assert.equal(result.metadata.source, "sale");
  assert.equal(result.metadata.source_sale_id, "00000000-0000-0000-0000-000000000008");
  assert.equal(result.metadata.delivery_fee_source, "NO_FEE");
});

test("DeliveriesService.createFromSale rejects missing address or branch mismatch", async () => {
  const missingAddress = buildSaleCreateHarness({
    sale: buildSaleSource({ customer_address: null }),
  });

  await assert.rejects(
    () =>
      missingAddress.service.createFromSale(
        "00000000-0000-0000-0000-000000000008",
        {},
        actor
      ),
    BadRequestException
  );

  const wrongBranch = buildSaleCreateHarness();
  await assert.rejects(
    () =>
      wrongBranch.service.createFromSale(
        "00000000-0000-0000-0000-000000000008",
        {},
        { ...actor, branchId: "00000000-0000-0000-0000-000000000099" }
      ),
    ForbiddenException
  );
});

test("DeliveriesService.createFromSale rejects another tenant", async () => {
  const harness = buildSaleCreateHarness();

  await assert.rejects(
    () =>
      harness.service.createFromSale(
        "00000000-0000-0000-0000-000000000008",
        {},
        { ...actor, tenantId: "00000000-0000-0000-0000-000000000099" }
      ),
      NotFoundException
  );
});

test("DeliveriesService.createFromSale enforces delivery fee source", async () => {
  const invalidSource = buildSaleCreateHarness();

  await assert.rejects(
    () =>
      invalidSource.service.createFromSale(
        "00000000-0000-0000-0000-000000000008",
        {
          delivery_fee: 500,
          delivery_fee_source: "NO_FEE",
        },
        actor
      ),
    BadRequestException
  );

  const validSource = buildSaleCreateHarness();
  const result = await validSource.service.createFromSale(
    "00000000-0000-0000-0000-000000000008",
    {
      delivery_fee: 500,
      delivery_fee_source: "INVOICE_INCLUDED",
    },
    actor
  );

  assert.equal(result.delivery_fee, 500);
  assert.equal(result.metadata.delivery_fee_source, "INVOICE_INCLUDED");
});

test("DeliveriesService.createFromSale rejects duplicate sale or order delivery", async () => {
  const harness = buildSaleCreateHarness({
    duplicate: buildDelivery({
      sale_id: "00000000-0000-0000-0000-000000000008",
      order_id: orderId,
    }),
  });

  await assert.rejects(
    () =>
      harness.service.createFromSale(
        "00000000-0000-0000-0000-000000000008",
        {},
        actor
      ),
    BadRequestException
  );
});

test("DeliveriesService.getBySale returns delivery by sale or linked order", async () => {
  const created = buildDelivery({
    sale_id: "00000000-0000-0000-0000-000000000008",
    order_id: orderId,
  });
  const lookupHarness = new DeliveriesService(
    {
      query: async (queryText: string) => {
        if (queryText.includes("FROM public.sales s")) {
          return { rows: [buildSaleSource()] };
        }
        if (queryText.includes("FROM public.deliveries")) {
          return { rows: [created] };
        }

        throw new Error(`Unexpected db query: ${queryText}`);
      },
    } as never,
    {} as never,
    new DeliveryStateMachineService()
  );

  const result = await lookupHarness.getBySale(
    "00000000-0000-0000-0000-000000000008",
    actor
  );

  assert.ok(result);
  assert.equal(result.sale_id, "00000000-0000-0000-0000-000000000008");
  assert.equal(result.order_id, orderId);
});

test("DeliveriesService.list filters by sale_id", async () => {
  const queries: string[] = [];
  const db = {
    query: async (queryText: string, params: unknown[] = []) => {
      queries.push(queryText);

      if (queryText.includes("FROM public.deliveries")) {
        assert.equal(params[0], tenantId);
        assert.equal(params[1], "00000000-0000-0000-0000-000000000008");
        return {
          rows: [
            buildDelivery({
              sale_id: "00000000-0000-0000-0000-000000000008",
              total_count: "1",
            }),
          ],
        };
      }

      throw new Error(`Unexpected db query: ${queryText}`);
    },
  };

  const service = new DeliveriesService(
    db as never,
    {} as never,
    new DeliveryStateMachineService()
  );

  const result = await service.list(
    {
      sale_id: "00000000-0000-0000-0000-000000000008",
      page: 1,
      limit: 25,
    },
    actor
  );

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].sale_id, "00000000-0000-0000-0000-000000000008");
  assert.equal(queries.join("\n").includes("sale_id ="), true);
});

test("DeliveriesService.list maps operational status filter to compatible DB values", async () => {
  const db = {
    query: async (queryText: string, params: unknown[] = []) => {
      if (queryText.includes("FROM public.deliveries")) {
        assert.deepEqual(params[1], ["CREADO", "CREATED"]);
        assert.equal(queryText.includes("status = ANY"), true);
        return {
          rows: [
            buildDelivery({
              status: "CREATED",
              total_count: "1",
            }),
          ],
        };
      }

      throw new Error(`Unexpected db query: ${queryText}`);
    },
  };

  const service = new DeliveriesService(
    db as never,
    {} as never,
    new DeliveryStateMachineService()
  );

  const result = await service.list(
    {
      status: "CREADO",
      page: 1,
      limit: 25,
    },
    actor
  );

  assert.equal(result.data[0].status, "CREADO");
});
