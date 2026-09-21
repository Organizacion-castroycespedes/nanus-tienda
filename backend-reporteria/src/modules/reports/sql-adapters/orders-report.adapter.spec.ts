import assert from "node:assert/strict";
import test from "node:test";
import { OrdersReportAdapter } from "./orders-report.adapter";

const actor = { userId: "user-1", role: "USER", tenantId: "tenant-1", branchId: "branch-1" };
const filters = { tenantId: "tenant-1", branchId: "branch-1", dateFrom: "2026-09-01T00:00:00.000Z", dateTo: "2026-09-21T00:00:00.000Z" };

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
  assert.match(queries[1].sql, /payment_allocations/);
});
