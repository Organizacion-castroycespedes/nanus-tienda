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
const driverId = "00000000-0000-0000-0000-000000000010";
const cashSessionId = "00000000-0000-0000-0000-000000000011";
const cashRegisterId = "00000000-0000-0000-0000-000000000012";
const terminalId = "00000000-0000-0000-0000-000000000013";

const actor = {
  tenantId,
  userId: actorUserId,
  roles: ["ADMIN"],
  cashSessionId,
};

const driverSchemaRow = {
  has_driver_table: true,
  has_driver_column: true,
};

const cashSchemaRow = {
  has_cash_columns: true,
  has_cash_tables: true,
};

const isDriverSchemaQuery = (queryText: string) =>
  queryText.includes("information_schema.tables") &&
  queryText.includes("delivery_drivers");

const isCashSchemaQuery = (queryText: string) =>
  queryText.includes("information_schema.columns") &&
  queryText.includes("cash_session_id");

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
  driver_id: null,
  driver_name: null,
  driver_phone: null,
  driver_document_number: null,
  driver_active: null,
  cash_session_id: null,
  cash_register_id: null,
  terminal_id: null,
  cash_impact_amount: "0",
  cash_impact_recorded_at: null,
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
  cash_session_id: cashSessionId,
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
      if (queryText.includes("FROM public.delivery_drivers")) {
        return {
          rows: [
            {
              id: driverId,
              active: true,
            },
          ],
        };
      }
      if (queryText.includes("WITH updated AS") && queryText.includes("driver_id =")) {
        return {
          rows: [
            {
              ...initialDelivery,
              driver_id: params[0],
              driver_name: params[0] ? "Carlos Repartidor" : null,
              driver_phone: params[0] ? "3001234567" : null,
              driver_document_number: params[0] ? "123456" : null,
              driver_active: params[0] ? true : null,
              updated_by_user_id: params[1],
            },
          ],
        };
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
    query: async (queryText: string) => {
      if (isDriverSchemaQuery(queryText)) {
        return { rows: [driverSchemaRow] };
      }
      if (isCashSchemaQuery(queryText)) {
        return { rows: [cashSchemaRow] };
      }
      return { rows: [{ id: courierId }] };
    },
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

const buildUpdateHarness = (options: {
  initialDelivery?: Record<string, unknown>;
  cashRows?: Record<string, unknown>[];
  cashSchema?: Record<string, unknown>;
} = {}) => {
  const initialDelivery =
    options.initialDelivery ?? buildDelivery({ delivery_fee: "0" });
  const cashRows =
    options.cashRows ??
    [
      {
        cash_session_id: cashSessionId,
        cash_register_id: cashRegisterId,
        terminal_id: terminalId,
      },
    ];
  const queries: string[] = [];
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
      if (queryText.includes("FROM public.cash_sessions AS session")) {
        return { rows: cashRows };
      }
      if (queryText.includes("UPDATE public.deliveries")) {
        const cashSessionParamIndex = params.indexOf(cashSessionId);
        return {
          rows: [
            buildDelivery({
              ...initialDelivery,
              delivery_fee: params[0],
              cash_session_id: cashSessionParamIndex >= 0 ? cashSessionId : null,
              cash_register_id: cashSessionParamIndex >= 0 ? cashRegisterId : null,
              terminal_id: cashSessionParamIndex >= 0 ? terminalId : null,
              cash_impact_amount:
                cashSessionParamIndex >= 0 ? params[cashSessionParamIndex + 3] : "0",
              cash_impact_recorded_at: cashSessionParamIndex >= 0
                ? "2026-06-20T00:00:00.000Z"
                : null,
            }),
          ],
        };
      }

      throw new Error(`Unexpected client query: ${queryText}`);
    },
    release: () => {
      released = true;
    },
  };

  const db = {
    query: async (queryText: string) => {
      queries.push(queryText);
      if (isDriverSchemaQuery(queryText)) {
        return { rows: [driverSchemaRow] };
      }
      if (isCashSchemaQuery(queryText)) {
        return { rows: [options.cashSchema ?? cashSchemaRow] };
      }
      return { rows: [] };
    },
    getClient: async () => client,
  };

  const service = new DeliveriesService(
    db as never,
    {} as never,
    new DeliveryStateMachineService()
  );

  return {
    service,
    queries,
    get committed() {
      return committed;
    },
    get rolledBack() {
      return rolledBack;
    },
    get released() {
      return released;
    },
  };
};

const buildOrderCreateHarness = (options: {
  order?: Record<string, unknown> | null;
  duplicate?: Record<string, unknown> | null;
  driverRows?: Record<string, unknown>[];
} = {}) => {
  const order = options.order === undefined ? buildOrderSource() : options.order;
  const duplicate = options.duplicate ?? null;
  const driverRows = options.driverRows ?? [{ id: driverId, active: true }];
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
      if (queryText.includes("FROM public.delivery_drivers")) {
        assert.deepEqual(params, [driverId, tenantId]);
        return { rows: driverRows };
      }
      if (queryText.includes("FROM public.cash_sessions AS session")) {
        return {
          rows: [
            {
              cash_session_id: cashSessionId,
              cash_register_id: cashRegisterId,
              terminal_id: terminalId,
            },
          ],
        };
      }
      if (queryText.includes("UPDATE public.deliveries")) {
        const metadataParam = params.find(
          (item) => typeof item === "string" && item.startsWith("{")
        );
        return {
          rows: [
            buildDelivery({
              ...(duplicate ?? {}),
              id: params[0],
              tenant_id: params[1],
              cash_session_id: params[2],
              cash_register_id: params[3],
              terminal_id: params[4],
              cash_impact_amount: params[5],
              cash_impact_recorded_at: params[6],
              updated_by_user_id: params[7],
              metadata: {
                ...((duplicate?.metadata as Record<string, unknown> | undefined) ?? {}),
                ...(metadataParam ? JSON.parse(String(metadataParam)) : {}),
              },
            }),
          ],
        };
      }
      if (queryText.includes("INSERT INTO public.deliveries")) {
        const hasDriverInsert = queryText.includes("driver_id");
        const cashSessionParamIndex = params.indexOf(cashSessionId);
        const metadataParam = params.find(
          (item) => typeof item === "string" && item.startsWith("{")
        );
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
              status: params[6],
              customer_name: params[7],
              customer_phone: params[8],
              delivery_address: params[9],
              delivery_reference: params[10],
              delivery_fee: params[11],
              subtotal: params[12],
              total: params[13],
              payment_method_id: params[14],
              driver_id: hasDriverInsert ? driverId : null,
              cash_session_id: cashSessionParamIndex >= 0 ? cashSessionId : null,
              cash_register_id: cashSessionParamIndex >= 0 ? cashRegisterId : null,
              terminal_id: cashSessionParamIndex >= 0 ? terminalId : null,
              cash_impact_amount:
                cashSessionParamIndex >= 0 ? params[cashSessionParamIndex + 3] : "0",
              cash_impact_recorded_at: cashSessionParamIndex >= 0
                ? "2026-06-20T00:00:00.000Z"
                : null,
              metadata: metadataParam ? JSON.parse(String(metadataParam)) : {},
              created_by_user_id: actorUserId,
              updated_by_user_id: actorUserId,
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

      if (isDriverSchemaQuery(queryText)) {
        return { rows: [driverSchemaRow] };
      }
      if (isCashSchemaQuery(queryText)) {
        return { rows: [cashSchemaRow] };
      }
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
  driverRows?: Record<string, unknown>[];
} = {}) => {
  const sale = options.sale === undefined ? buildSaleSource() : options.sale;
  const duplicate = options.duplicate ?? null;
  const driverRows = options.driverRows ?? [{ id: driverId, active: true }];
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
      if (queryText.includes("FROM public.delivery_drivers")) {
        assert.deepEqual(params, [driverId, tenantId]);
        return { rows: driverRows };
      }
      if (queryText.includes("FROM public.cash_sessions AS session")) {
        return {
          rows: [
            {
              cash_session_id: cashSessionId,
              cash_register_id: cashRegisterId,
              terminal_id: terminalId,
            },
          ],
        };
      }
      if (queryText.includes("INSERT INTO public.deliveries")) {
        const hasDriverInsert = queryText.includes("driver_id");
        const cashSessionParamIndex = params.indexOf(cashSessionId);
        const metadataParam = params.find(
          (item) => typeof item === "string" && item.startsWith("{")
        );
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
              status: params[6],
              customer_name: params[7],
              customer_phone: params[8],
              delivery_address: params[9],
              delivery_reference: params[10],
              delivery_fee: params[11],
              subtotal: params[12],
              total: params[13],
              payment_method_id: params[14],
              driver_id: hasDriverInsert ? driverId : null,
              cash_session_id: cashSessionParamIndex >= 0 ? cashSessionId : null,
              cash_register_id: cashSessionParamIndex >= 0 ? cashRegisterId : null,
              terminal_id: cashSessionParamIndex >= 0 ? terminalId : null,
              cash_impact_amount:
                cashSessionParamIndex >= 0 ? params[cashSessionParamIndex + 3] : "0",
              cash_impact_recorded_at: cashSessionParamIndex >= 0
                ? "2026-06-20T00:00:00.000Z"
                : null,
              metadata: metadataParam ? JSON.parse(String(metadataParam)) : {},
              created_by_user_id: actorUserId,
              updated_by_user_id: actorUserId,
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

      if (isDriverSchemaQuery(queryText)) {
        return { rows: [driverSchemaRow] };
      }
      if (isCashSchemaQuery(queryText)) {
        return { rows: [cashSchemaRow] };
      }
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

      if (isDriverSchemaQuery(queryText)) {
        return { rows: [driverSchemaRow] };
      }
      if (isCashSchemaQuery(queryText)) {
        return { rows: [cashSchemaRow] };
      }
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

test("DeliveriesService.assignDriver assigns active driver without changing status", async () => {
  const harness = buildHarness(buildDelivery({ status: "CREATED" }));

  const result = await harness.service.assignDriver(
    deliveryId,
    { driver_id: driverId },
    actor
  );

  assert.equal(result.status, "CREADO");
  assert.equal(result.driver_id, driverId);
  assert.equal(result.driver?.name, "Carlos Repartidor");
  assert.equal(harness.committed, true);
  assert.equal(harness.rolledBack, false);
  assert.equal(harness.historyParams.length, 0);
  assert.equal(
    harness.queries.some((query) => query.includes("status =")),
    false
  );
});

test("DeliveriesService.assignDriver clears driver without changing status", async () => {
  const harness = buildHarness(
    buildDelivery({ status: "ASSIGNED", driver_id: driverId })
  );

  const result = await harness.service.assignDriver(
    deliveryId,
    { driver_id: null },
    actor
  );

  assert.equal(result.status, "EN_PREPARACION");
  assert.equal(result.driver_id, null);
  assert.equal(harness.committed, true);
  assert.equal(harness.historyParams.length, 0);
});

test("DeliveriesService.assignDriver rejects inactive or cross-tenant driver", async () => {
  const buildDriverHarness = (driverRows: Record<string, unknown>[]) => {
    const harness = buildHarness(buildDelivery());
    const client = {
      query: async (queryText: string, params: unknown[] = []) => {
        harness.queries.push(queryText);
        if (queryText === "BEGIN") {
          return { rows: [] };
        }
        if (queryText === "COMMIT") {
          return { rows: [] };
        }
        if (queryText === "ROLLBACK") {
          return { rows: [] };
        }
        if (queryText.includes("FROM public.deliveries") && queryText.includes("FOR UPDATE")) {
          return { rows: [buildDelivery()] };
        }
        if (queryText.includes("FROM public.delivery_drivers")) {
          assert.deepEqual(params, [driverId, tenantId]);
          return { rows: driverRows };
        }
        throw new Error(`Unexpected query: ${queryText}`);
      },
      release: () => undefined,
    };

    return new DeliveriesService(
      {
        query: async (queryText: string) => {
      if (isDriverSchemaQuery(queryText)) {
        return { rows: [driverSchemaRow] };
      }
      if (isCashSchemaQuery(queryText)) {
        return { rows: [cashSchemaRow] };
      }
      throw new Error(`Unexpected db query: ${queryText}`);
        },
        getClient: async () => client,
      } as never,
      {} as never,
      new DeliveryStateMachineService()
    );
  };

  const inactiveService = buildDriverHarness([{ id: driverId, active: false }]);
  await assert.rejects(
    () => inactiveService.assignDriver(deliveryId, { driver_id: driverId }, actor),
    BadRequestException
  );

  const otherTenantService = buildDriverHarness([]);
  await assert.rejects(
    () => otherTenantService.assignDriver(deliveryId, { driver_id: driverId }, actor),
    BadRequestException
  );
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

test("DeliveriesService.update attaches current cash for cash-impact edits", async () => {
  const harness = buildUpdateHarness();

  const result = await harness.service.update(
    deliveryId,
    { delivery_fee: 2500 },
    actor
  );

  assert.equal(result.delivery_fee, 2500);
  assert.equal(result.cash_session_id, cashSessionId);
  assert.equal(result.cash_register_id, cashRegisterId);
  assert.equal(result.terminal_id, terminalId);
  assert.equal(result.cash_impact_amount, 2500);
  assert.equal(harness.committed, true);
  assert.equal(harness.rolledBack, false);
  assert.equal(
    harness.queries.join("\n").toLowerCase().includes("cash_movements"),
    false
  );
  assert.equal(harness.queries.join("\n").toLowerCase().includes("payments"), false);
});

test("DeliveriesService.update rejects cash-impact edits without open cash", async () => {
  const harness = buildUpdateHarness({ cashRows: [] });

  await assert.rejects(
    () => harness.service.update(deliveryId, { delivery_fee: 2500 }, actor),
    BadRequestException
  );

  assert.equal(harness.committed, false);
  assert.equal(harness.rolledBack, true);
  assert.equal(harness.released, true);
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
  assert.equal(result.cash_session_id, cashSessionId);
  assert.equal(result.cash_register_id, cashRegisterId);
  assert.equal(result.terminal_id, terminalId);
  assert.equal(result.cash_impact_amount, 1500);
  assert.equal(result.metadata.source, "order");
  assert.equal(result.metadata.source_order_id, orderId);
  assert.equal(result.metadata.source_order_without_cash_session, false);
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

test("DeliveriesService.createFromOrder stores current cash context with zero delivery fee", async () => {
  const harness = buildOrderCreateHarness();

  const result = await harness.service.createFromOrder(orderId, {}, actor);

  assert.equal(result.status, "CREADO");
  assert.equal(result.order_id, orderId);
  assert.equal(result.delivery_fee, 0);
  assert.equal(result.cash_session_id, cashSessionId);
  assert.equal(result.cash_register_id, cashRegisterId);
  assert.equal(result.terminal_id, terminalId);
  assert.equal(result.cash_impact_amount, 0);
  assert.equal(result.metadata.source_order_without_cash_session, false);
  assert.equal(
    harness.queries.join("\n").toLowerCase().includes("cash_movements"),
    false
  );
  assert.equal(harness.queries.join("\n").toLowerCase().includes("payments"), false);
});

test("DeliveriesService.createFromOrder marks historical order without cash session", async () => {
  const harness = buildOrderCreateHarness({
    order: buildOrderSource({ cash_session_id: null }),
  });

  const result = await harness.service.createFromOrder(orderId, {}, actor);

  assert.equal(result.cash_session_id, cashSessionId);
  assert.equal(result.cash_impact_amount, 0);
  assert.equal(result.metadata.source_order_without_cash_session, true);
});

test("DeliveriesService.createFromOrder rejects order from another cash session", async () => {
  const harness = buildOrderCreateHarness({
    order: buildOrderSource({
      cash_session_id: "00000000-0000-0000-0000-000000000099",
    }),
  });

  await assert.rejects(
    () => harness.service.createFromOrder(orderId, {}, actor),
    ForbiddenException
  );

  assert.equal(harness.rolledBack, true);
  assert.equal(harness.historyParams.length, 0);
});

test("DeliveriesService.createFromOrder completes existing CREADO delivery without cash context", async () => {
  const harness = buildOrderCreateHarness({
    duplicate: buildDelivery({
      order_id: orderId,
      status: "CREATED",
      cash_session_id: null,
      delivery_fee: "0",
      metadata: { source: "order" },
    }),
  });

  const result = await harness.service.createFromOrder(orderId, {}, actor);

  assert.equal(result.id, deliveryId);
  assert.equal(result.cash_session_id, cashSessionId);
  assert.equal(result.cash_impact_amount, 0);
  assert.equal(result.metadata.cash_context_completed_from_order, true);
  assert.equal(
    harness.queries.some((query) => query.includes("INSERT INTO public.deliveries")),
    false
  );
});

test("DeliveriesService.createFromOrder stores active driver without changing status", async () => {
  const harness = buildOrderCreateHarness();

  const result = await harness.service.createFromOrder(
    orderId,
    { delivery_fee: 1500, driver_id: driverId },
    actor
  );

  assert.equal(result.status, "CREADO");
  assert.equal(result.driver_id, driverId);
  assert.equal(harness.committed, true);
  assert.equal(harness.historyParams.length, 1);
  assert.equal(harness.historyParams[0][2], "CREATED");
  assert.equal(
    harness.queries.some((query) => query.includes("UPDATE public.deliveries")),
    false
  );
});

test("DeliveriesService.createFromOrder rejects inactive driver", async () => {
  const harness = buildOrderCreateHarness({
    driverRows: [{ id: driverId, active: false }],
  });

  await assert.rejects(
    () =>
      harness.service.createFromOrder(
        orderId,
        { driver_id: driverId },
        actor
      ),
    BadRequestException
  );

  assert.equal(harness.rolledBack, true);
  assert.equal(harness.historyParams.length, 0);
  assert.equal(
    harness.queries.some((query) => query.includes("INSERT INTO public.deliveries")),
    false
  );
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
  assert.equal(joinedQueries.includes("cash_movements"), false);
  assert.equal(joinedQueries.includes("payments"), false);
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

test("DeliveriesService.create with sale_id keeps linked order_id", async () => {
  const harness = buildSaleCreateHarness();

  const result = await harness.service.create(
    {
      branch_id: branchId,
      sale_id: "00000000-0000-0000-0000-000000000008",
      customer_name: "Cliente factura",
      customer_phone: "3222222222",
      delivery_address: "Carrera factura 99",
    },
    actor
  );

  assert.equal(result.sale_id, "00000000-0000-0000-0000-000000000008");
  assert.equal(result.order_id, orderId);
  assert.equal(harness.committed, true);
  assert.equal(harness.rolledBack, false);
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
        if (isDriverSchemaQuery(queryText)) {
          return { rows: [driverSchemaRow] };
        }
        if (isCashSchemaQuery(queryText)) {
          return { rows: [cashSchemaRow] };
        }
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

      if (isDriverSchemaQuery(queryText)) {
        return { rows: [driverSchemaRow] };
      }
      if (isCashSchemaQuery(queryText)) {
        return { rows: [cashSchemaRow] };
      }
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

test("DeliveriesService.list filters by driver_id and maps driver summary", async () => {
  const queries: string[] = [];
  const db = {
    query: async (queryText: string, params: unknown[] = []) => {
      queries.push(queryText);

      if (isDriverSchemaQuery(queryText)) {
        return { rows: [driverSchemaRow] };
      }
      if (isCashSchemaQuery(queryText)) {
        return { rows: [cashSchemaRow] };
      }
      if (queryText.includes("FROM public.deliveries")) {
        assert.equal(params[0], tenantId);
        assert.equal(params[1], driverId);
        return {
          rows: [
            buildDelivery({
              driver_id: driverId,
              driver_name: "Carlos Repartidor",
              driver_phone: "3001234567",
              driver_document_number: "123456",
              driver_active: true,
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
      driver_id: driverId,
      page: 1,
      limit: 25,
    },
    actor
  );

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].driver_id, driverId);
  assert.equal(result.data[0].driver?.name, "Carlos Repartidor");
  assert.equal(queries.join("\n").includes("d.driver_id ="), true);
});

test("DeliveriesService.list works when driver migration is pending", async () => {
  const queries: string[] = [];
  const db = {
    query: async (queryText: string) => {
      queries.push(queryText);

      if (isDriverSchemaQuery(queryText)) {
        return {
          rows: [{ has_driver_table: false, has_driver_column: false }],
        };
      }
      if (isCashSchemaQuery(queryText)) {
        return { rows: [cashSchemaRow] };
      }
      if (queryText.includes("FROM public.deliveries")) {
        assert.equal(queryText.includes("public.delivery_drivers"), false);
        assert.equal(queryText.includes("NULL::uuid AS driver_id"), true);
        return {
          rows: [
            buildDelivery({
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

  const result = await service.list({ page: 1, limit: 25 }, actor);

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].driver_id, null);
  assert.equal(queries.some((query) => isDriverSchemaQuery(query)), true);
});

test("DeliveriesService.list maps operational status filter to compatible DB values", async () => {
  const db = {
    query: async (queryText: string, params: unknown[] = []) => {
      if (isDriverSchemaQuery(queryText)) {
        return { rows: [driverSchemaRow] };
      }
      if (isCashSchemaQuery(queryText)) {
        return { rows: [cashSchemaRow] };
      }
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
