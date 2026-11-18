import assert from "node:assert/strict";
import test from "node:test";
import { OperationalSalesService } from "./operational-sales.service";

/**
 * corregir-anulacion-ventas-pedido: al anular una venta que viene de un pedido, el inventario
 * vuelve aunque la salida se haya creado al entregar el pedido (reference_table = 'orders').
 */

type Options = {
  orderId?: string | null;
  ownSaleMovements?: boolean;
  lines?: Array<{ product_id: string; quantity: string; is_inventoryable?: boolean; requires_serial?: boolean }>;
  orderOuts?: Record<string, Array<{ id: string; quantity: string }>>;
  returnedByOtherSales?: Record<string, string>;
  deliveredLots?: Array<{ lot_id: string; location_id: string | null; quantity: string }>;
  returnedLots?: Array<{ lot_id: string; location_id: string | null; quantity: string }>;
  saleTotal?: string;
  ownSalePayments?: Array<{ id: string; payment_method_id: string; amount: string; reference_number: string | null; cash_session_id: string | null; status: string }>;
  orderPayments?: Array<{ id: string; payment_method_id: string; amount: string; reference_number: string | null; cash_session_id: string | null }>;
  refundedByOtherSales?: string;
  fullyRefundedOrderPayments?: string;
};

const build = (options: Options) => {
  const movements: Array<Record<string, unknown>> = [];
  const balanceUpdates: Array<{ quantity: number; lotId: string }> = [];
  const lotLinks: Array<{ movementId: string; lotId: string; quantity: number }> = [];
  const serialCalls: Array<Record<string, unknown>> = [];
  const queries: string[] = [];
  const refundPayments: Array<{ amount: number; methodId: string; referenceId: string; cashSessionId: unknown }> = [];
  const cashMovements: Array<{ amount: number; paymentId: string }> = [];
  const refundedPaymentIds: string[] = [];
  const saleStatuses: string[] = [];

  const client = {
    query: async (text: string, params: unknown[] = []) => {
      const sql = text.replace(/\s+/g, " ").trim();
      queries.push(sql);
      if (sql.includes("FROM sales") && sql.includes("FOR UPDATE")) {
        return {
          rows: [
            {
              id: params[0],
              branch_id: "branch-a",
              status: "CONFIRMED",
              payment_status: "PAID",
              order_id: options.orderId === undefined ? "order-1" : options.orderId,
              total: options.saleTotal ?? "100",
            },
          ],
        };
      }
      if (sql.includes("reference_table = 'sales' AND type = 'OUT'") && sql.includes("LIMIT 1")) {
        return { rows: options.ownSaleMovements ? [{ "?column?": 1 }] : [] };
      }
      if (sql.includes("reference_table = 'sales' AND type = 'OUT'")) {
        // Flujo POS existente: salidas propias de la venta.
        return {
          rows: options.ownSaleMovements
            ? [{ id: "pos-out-1", product_id: "p-cable", quantity: "2", branch_id: "branch-a", terminal_id: null, pos_session_code: null, user_id: null }]
            : [],
        };
      }
      if (sql.includes("FROM sale_items si")) {
        return { rows: options.lines ?? [] };
      }
      if (sql.includes("reference_table = 'orders'")) {
        return {
          rows: (options.orderOuts?.[String(params[2])] ?? []).map((row) => ({
            ...row,
            branch_id: "branch-a",
            terminal_id: "terminal-1",
            pos_session_code: null,
            user_id: "user-delivery",
          })),
        };
      }
      if (sql.includes("COALESCE(SUM(sm.quantity), 0)")) {
        return { rows: [{ returned: options.returnedByOtherSales?.[String(params[2])] ?? "0" }] };
      }
      if (sql.includes("FROM stock_movement_lots sml") && sql.includes("ANY($2::uuid[])")) {
        return { rows: options.deliveredLots ?? [] };
      }
      if (sql.includes("GROUP BY sml.lot_id")) {
        return { rows: options.returnedLots ?? [] };
      }
      if (sql.startsWith("UPDATE inventory_lot_balances")) {
        balanceUpdates.push({ quantity: Number(params[0]), lotId: String(params[4]) });
        return { rows: [{ id: `balance-${params[4]}` }] };
      }
      if (sql.startsWith("INSERT INTO stock_movement_lots")) {
        lotLinks.push({ movementId: String(params[1]), lotId: String(params[3]), quantity: Number(params[5]) });
        return { rows: [] };
      }
      if (sql.includes("FROM stock_movement_lots")) {
        return { rows: [] };
      }
      if (sql.includes("FROM cash_sessions")) {
        return { rows: [{ id: "session-1" }] };
      }
      if (sql.includes("reference_type = 'SALES_ORDER' AND reference_id = $2") && sql.includes("FOR UPDATE")) {
        return { rows: options.orderPayments ?? [] };
      }
      if (sql.includes("refunded_by_other_sales")) {
        return {
          rows: [
            {
              refunded_by_other_sales: options.refundedByOtherSales ?? "0",
              fully_refunded_order_payments: options.fullyRefundedOrderPayments ?? "0",
            },
          ],
        };
      }
      if (sql.includes("FROM payments") && sql.includes("FOR UPDATE")) {
        return { rows: options.ownSalePayments ?? [] };
      }
      if (sql.startsWith("INSERT INTO payments")) {
        refundPayments.push({
          amount: Number(params[5]),
          methodId: String(params[2]),
          referenceId: String(params[4]),
          cashSessionId: params[3],
        });
        return { rows: [{ id: `refund-${refundPayments.length}` }] };
      }
      if (sql.startsWith("INSERT INTO cash_movements")) {
        cashMovements.push({ amount: Number(params[5]), paymentId: String(params[3]) });
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE payments SET status = 'REFUNDED'")) {
        refundedPaymentIds.push(String(params[0]));
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE sales")) {
        saleStatuses.push(String(params[2]));
        return { rows: [] };
      }
      return { rows: [] };
    },
    release: () => undefined,
  };

  const stockMovementService = {
    createMovement: async (data: Record<string, unknown>) => {
      const movement = { ...data, id: `reverse-${movements.length + 1}` };
      movements.push(movement);
      return movement;
    },
  };
  const productSerialService = {
    markReturnedForSale: async () => 0,
    markReturnedForOrderSale: async (_client: unknown, input: Record<string, unknown>) => {
      serialCalls.push(input);
      return 0;
    },
  };

  const service = new OperationalSalesService(
    {} as never,
    {} as never,
    {} as never,
    { logEvent: () => undefined } as never,
    undefined,
    { getClient: async () => client } as never,
    stockMovementService as never,
    productSerialService as never
  );
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };
  const applyVoid = (returnInventory: boolean) =>
    (service as unknown as {
      applySaleVoid: (...args: unknown[]) => Promise<unknown>;
    }).applySaleVoid(actor, "tenant-a", "sale-1", { reason: "Cliente desiste", returnInventory }, null);

  return {
    applyVoid,
    movements,
    balanceUpdates,
    lotLinks,
    serialCalls,
    queries,
    refundPayments,
    cashMovements,
    refundedPaymentIds,
    saleStatuses,
  };
};

test("anulación de venta de pedido devuelve lo facturado aunque la salida esté a nombre del pedido", async () => {
  const ctx = build({
    lines: [
      { product_id: "p-cable", quantity: "1.5" },
      { product_id: "p-coronita", quantity: "7" },
      { product_id: "p-servicio", quantity: "1", is_inventoryable: false },
    ],
    orderOuts: {
      "p-cable": [{ id: "order-out-cable", quantity: "1.5" }],
      "p-coronita": [{ id: "order-out-coronita", quantity: "7" }],
    },
  });

  await ctx.applyVoid(true);

  assert.deepEqual(
    ctx.movements.map((movement) => [movement.productId, movement.type, movement.quantity, movement.referenceTable, movement.referenceId, movement.branchId]),
    [
      ["p-cable", "IN", 1.5, "sales", "sale-1", "branch-a"],
      ["p-coronita", "IN", 7, "sales", "sale-1", "branch-a"],
    ]
  );
});

test("anulación de venta de pedido sin devolver inventario no crea entradas", async () => {
  const ctx = build({
    lines: [{ product_id: "p-cable", quantity: "1.5" }],
    orderOuts: { "p-cable": [{ id: "order-out-cable", quantity: "1.5" }] },
  });

  await ctx.applyVoid(false);

  assert.equal(ctx.movements.length, 0);
});

test("anulación de venta de pedido no devuelve más de lo entregado menos lo ya devuelto por otras anulaciones", async () => {
  const ctx = build({
    lines: [{ product_id: "p-cable", quantity: "5" }],
    orderOuts: { "p-cable": [{ id: "order-out-cable", quantity: "6" }] },
    returnedByOtherSales: { "p-cable": "4" },
  });

  await ctx.applyVoid(true);

  assert.equal(ctx.movements.length, 1);
  assert.equal(ctx.movements[0].quantity, 2);
});

test("anulación de venta de pedido con lote devuelve el saldo a los lotes de la entrega", async () => {
  const ctx = build({
    lines: [{ product_id: "p-cerveza", quantity: "5" }],
    orderOuts: { "p-cerveza": [{ id: "order-out-1", quantity: "5" }] },
    deliveredLots: [
      { lot_id: "lot-b", location_id: null, quantity: "3" },
      { lot_id: "lot-a", location_id: null, quantity: "2" },
    ],
  });

  await ctx.applyVoid(true);

  assert.deepEqual(ctx.balanceUpdates, [
    { quantity: 3, lotId: "lot-b" },
    { quantity: 2, lotId: "lot-a" },
  ]);
  assert.deepEqual(ctx.lotLinks, [
    { movementId: "reverse-1", lotId: "lot-b", quantity: 3 },
    { movementId: "reverse-1", lotId: "lot-a", quantity: 2 },
  ]);
});

test("anulación de venta de pedido con lote descuenta lo devuelto antes al mismo lote", async () => {
  const ctx = build({
    lines: [{ product_id: "p-cerveza", quantity: "2" }],
    orderOuts: { "p-cerveza": [{ id: "order-out-1", quantity: "5" }] },
    returnedByOtherSales: { "p-cerveza": "3" },
    deliveredLots: [
      { lot_id: "lot-b", location_id: null, quantity: "3" },
      { lot_id: "lot-a", location_id: null, quantity: "2" },
    ],
    returnedLots: [{ lot_id: "lot-b", location_id: null, quantity: "3" }],
  });

  await ctx.applyVoid(true);

  assert.deepEqual(ctx.balanceUpdates, [{ quantity: 2, lotId: "lot-a" }]);
});

test("anulación de venta de pedido marca las series del pedido", async () => {
  const ctx = build({
    lines: [
      { product_id: "p-celular", quantity: "1", requires_serial: true },
      { product_id: "p-cable", quantity: "2" },
    ],
    orderOuts: {
      "p-celular": [{ id: "order-out-celular", quantity: "1" }],
      "p-cable": [{ id: "order-out-cable", quantity: "2" }],
    },
  });

  await ctx.applyVoid(true);

  assert.equal(ctx.serialCalls.length, 1);
  assert.equal(ctx.serialCalls[0].orderId, "order-1");
  assert.deepEqual(ctx.serialCalls[0].lines, [{ productId: "p-celular", quantity: 1 }]);
  assert.equal(ctx.serialCalls[0].returnInventory, true);
});

test("venta del POS (salidas propias) sigue el flujo existente y no consulta el pedido", async () => {
  const ctx = build({ orderId: "order-1", ownSaleMovements: true });

  await ctx.applyVoid(true);

  assert.equal(ctx.movements.length, 1);
  assert.equal(ctx.movements[0].quantity, 2);
  assert.equal(ctx.queries.some((sql) => sql.includes("FROM sale_items si")), false);
  assert.equal(ctx.queries.some((sql) => sql.includes("reference_table = 'orders'")), false);
  assert.equal(ctx.serialCalls.length, 0);
});

test("venta del POS sin pedido no ejecuta ninguna consulta del flujo de pedidos", async () => {
  const ctx = build({ orderId: null, ownSaleMovements: true });

  await ctx.applyVoid(true);

  assert.equal(ctx.queries.some((sql) => sql.includes("LIMIT 1") && sql.includes("reference_table = 'sales'")), false);
  assert.equal(ctx.queries.some((sql) => sql.includes("FROM sale_items si")), false);
  assert.equal(ctx.movements.length, 1);
});

test("anulación de venta de pedido reembolsa en caja el pago del pedido y queda Devuelta", async () => {
  const ctx = build({
    saleTotal: "1384082",
    orderPayments: [{ id: "order-pay-1", payment_method_id: "pm-cash", amount: "1384082", reference_number: null, cash_session_id: "session-old" }],
  });

  await ctx.applyVoid(true);

  assert.deepEqual(ctx.refundPayments, [
    { amount: 1384082, methodId: "pm-cash", referenceId: "sale-1", cashSessionId: "session-1" },
  ]);
  assert.deepEqual(ctx.cashMovements, [{ amount: 1384082, paymentId: "refund-1" }]);
  assert.deepEqual(ctx.refundedPaymentIds, ["order-pay-1"]);
  assert.deepEqual(ctx.saleStatuses, ["REFUNDED"]);
});

test("anulación de venta de pedido también reembolsa cuando no se devuelve inventario", async () => {
  const ctx = build({
    saleTotal: "100",
    orderPayments: [{ id: "order-pay-1", payment_method_id: "pm-cash", amount: "100", reference_number: null, cash_session_id: null }],
  });

  await ctx.applyVoid(false);

  assert.equal(ctx.refundPayments.length, 1);
  assert.deepEqual(ctx.saleStatuses, ["REFUNDED"]);
});

test("venta parcial de un pedido reembolsa solo el total de la venta y no marca el pago del pedido", async () => {
  const ctx = build({
    saleTotal: "40",
    orderPayments: [{ id: "order-pay-1", payment_method_id: "pm-cash", amount: "100", reference_number: null, cash_session_id: null }],
  });

  await ctx.applyVoid(true);

  assert.deepEqual(ctx.refundPayments.map((payment) => payment.amount), [40]);
  assert.deepEqual(ctx.refundedPaymentIds, []);
});

test("no reembolsa más de lo pagado menos lo reembolsado por otras ventas del pedido", async () => {
  const ctx = build({
    saleTotal: "80",
    orderPayments: [{ id: "order-pay-1", payment_method_id: "pm-cash", amount: "100", reference_number: null, cash_session_id: null }],
    refundedByOtherSales: "70",
  });

  await ctx.applyVoid(true);

  assert.deepEqual(ctx.refundPayments.map((payment) => payment.amount), [30]);
  assert.deepEqual(ctx.refundedPaymentIds, []);
});

test("reparte el reembolso entre varios pagos del pedido, el más reciente primero", async () => {
  const ctx = build({
    saleTotal: "150",
    orderPayments: [
      { id: "order-pay-2", payment_method_id: "pm-transfer", amount: "100", reference_number: "TRX-9", cash_session_id: null },
      { id: "order-pay-1", payment_method_id: "pm-cash", amount: "50", reference_number: null, cash_session_id: null },
    ],
  });

  await ctx.applyVoid(true);

  assert.deepEqual(
    ctx.refundPayments.map((payment) => [payment.methodId, payment.amount]),
    [["pm-transfer", 100], ["pm-cash", 50]]
  );
  assert.deepEqual(ctx.refundedPaymentIds, ["order-pay-2", "order-pay-1"]);
});

test("venta de pedido sin pagos queda Cancelada", async () => {
  const ctx = build({ orderPayments: [] });

  await ctx.applyVoid(true);

  assert.equal(ctx.refundPayments.length, 0);
  assert.deepEqual(ctx.saleStatuses, ["CANCELLED"]);
});

test("venta del POS con pagos propios no consulta pagos del pedido", async () => {
  const ctx = build({
    orderId: "order-1",
    ownSaleMovements: true,
    ownSalePayments: [{ id: "sale-pay-1", payment_method_id: "pm-cash", amount: "100", reference_number: null, cash_session_id: "session-1", status: "COMPLETED" }],
    orderPayments: [{ id: "order-pay-1", payment_method_id: "pm-cash", amount: "999", reference_number: null, cash_session_id: null }],
  });

  await ctx.applyVoid(true);

  assert.equal(ctx.queries.some((sql) => sql.includes("reference_type = 'SALES_ORDER'")), false);
  assert.deepEqual(ctx.refundPayments.map((payment) => payment.amount), [100]);
  assert.deepEqual(ctx.saleStatuses, ["REFUNDED"]);
});
