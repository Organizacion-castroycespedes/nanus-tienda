import assert from "node:assert/strict";
import test from "node:test";
import { PurchasesReportAdapter } from "./purchases-report.adapter";

const actor = { userId: "user-1", role: "USER", tenantId: "tenant-1", branchId: "branch-1" };
const filters = { tenantId: "tenant-1", branchId: "branch-1", dateFrom: "2026-09-01T00:00:00.000Z", dateTo: "2026-09-21T00:00:00.000Z", status: "RECEIVED" };

test("PurchasesReportAdapter export usa scope real, estado y orden estable", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = { query: async (sql: string, params: unknown[]) => { queries.push({ sql, params }); return queries.length === 1 ? { rows: [{ count: "1001" }] } : { rows: [{ purchaseId: "purchase-1", total: "10", totalPedido: "12", totalLiquidado: "10", diferenciaNoRecibida: "2", paid: "5", balance: "5" }] }; } };
  const adapter = new PurchasesReportAdapter({ executeFunction: async () => null } as never, { query: async () => ({ rows: [] }) } as never);
  assert.equal(await adapter.getPurchasesExportCount(actor, filters, client as never), 1001);
  const rows = await adapter.getPurchasesExportBatch(actor, filters, client as never, 1000, 1000);
  assert.equal(rows[0]?.total, 10);
  assert.match(queries[0].sql, /report_resolve_pos_scope\(\$2::text, \$3::uuid, \$4::uuid, \$5::uuid, \$6::uuid\)/);
  assert.match(queries[1].sql, /LIMIT \$11::integer OFFSET \$12::integer/);
  assert.match(queries[0].sql, /supplier_invoice_number ILIKE/);
  assert.deepEqual(queries[1].params.slice(-2), [1000, 1000]);
  assert.equal(queries[0].params[8], "RECEIVED");
  assert.equal(queries[0].params[9], null);
});
