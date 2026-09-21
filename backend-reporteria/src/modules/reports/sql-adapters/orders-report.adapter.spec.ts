import assert from "node:assert/strict";
import test from "node:test";
import { OrdersReportAdapter } from "./orders-report.adapter";

const actor = { userId: "user-1", role: "USER", tenantId: "tenant-1", branchId: "branch-1" };
const filters = { tenantId: "tenant-1", branchId: "branch-1", dateFrom: "2026-09-01T00:00:00.000Z", dateTo: "2026-09-21T00:00:00.000Z", customerDocument: "31900654" };

test("OrdersReportAdapter export usa scope, venta generada y orden estable", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = { query: async (sql: string, params: unknown[]) => { queries.push({ sql, params }); return queries.length === 1 ? { rows: [{ count: "1001" }] } : { rows: [{ orderId: "order-1", total: "10", paid: "5", balance: "5", status: "PARTIAL", paymentStatus: "PARTIAL", generatedSaleId: "sale-1" }] }; } };
  const adapter = new OrdersReportAdapter({ executeFunction: async () => null } as never, { query: async () => ({ rows: [] }) } as never);
  assert.equal(await adapter.getOrderSalesExportCount(actor, filters, client as never), 1001);
  const rows = await adapter.getOrderSalesExportBatch(actor, filters, client as never, 1000, 1000);
  assert.equal(rows[0]?.total, 10);
  assert.equal(rows[0]?.generatedSaleId, "sale-1");
  assert.match(queries[0].sql, /report_resolve_pos_scope\(\$2::text, \$3::uuid, \$4::uuid, \$5::uuid, \$6::uuid\)/);
  assert.match(queries[1].sql, /ORDER BY order_date DESC, order_id DESC/);
  assert.deepEqual(queries[1].params.slice(-2), [1000, 1000]);
  assert.equal(queries[0].params[8], "31900654");
  assert.match(queries[1].sql, /\$9::text IS NULL/);
  assert.match(queries[1].sql, /LIMIT \$10::integer OFFSET \$11::integer/);
  assert.match(queries[1].sql, /payment_allocations/);
});

test("OrdersReportAdapter Web list uses the same direct customer filter SQL", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return { rows: [{ orderId: "order-1", date: "2026-09-20T10:00:00.000Z", customerName: "Cliente", total: "10", paid: "5", balance: "5", status: "PARTIAL", paymentStatus: "PARTIAL", branchId: null, branchName: null, generatedSaleId: null }] };
    },
  };
  const adapter = new OrdersReportAdapter({ executeFunction: async () => null } as never, client as never);
  const dataset = await adapter.getOrderSalesList(actor, { ...filters, customerDocument: "31900654" });
  assert.equal(dataset?.rows[0]?.orderId, "order-1");
  assert.equal(queries[0].params[8], "31900654");
  assert.ok(!queries[0].sql.includes("report_orders_sales"));
  assert.match(queries[0].sql, /public\.customers/);
});
