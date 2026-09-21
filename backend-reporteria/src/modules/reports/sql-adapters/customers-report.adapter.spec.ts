import assert from "node:assert/strict";
import test from "node:test";
import { CustomersReportAdapter } from "./customers-report.adapter";

const actor = { userId: "user-1", role: "ADMIN", tenantId: "tenant-1", branchId: "branch-1" };
const filters = { tenantId: "tenant-1", customerDocument: "900654", customerName: "Cliente" };

test("Customer master adapter uses customers only and stable batch order", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return queries.length === 1
        ? { rows: [{ count: "1001" }] }
        : { rows: [{ customerId: "customer-1", name: "Cliente", taxResponsibilities: [], isActive: true, isFinalConsumer: false }] };
    },
  };
  const adapter = new CustomersReportAdapter({ executeFunction: async () => null } as never);
  assert.equal(await adapter.getCustomerMasterCount(actor, filters, client as never), 1001);
  const rows = await adapter.getCustomerMasterBatch(actor, filters, client as never, 1000, 1000);
  assert.equal(rows[0]?.customerId, "customer-1");
  assert.match(queries[0].sql, /public\.customers/);
  assert.match(queries[1].sql, /ORDER BY LOWER\(BTRIM\(name\)\) ASC, customer_id ASC/);
  assert.deepEqual(queries[1].params.slice(-2), [1000, 1000]);
  assert.ok(!queries[1].sql.match(/public\.(orders|sales|payments|payment_allocations)/));
  assert.equal(queries[0].params.length, 7);
  assert.deepEqual(queries[0].params, ["ADMIN", "tenant-1", "branch-1", "tenant-1", null, "900654", "Cliente"]);
  assert.deepEqual(queries[1].params, ["ADMIN", "tenant-1", "branch-1", "tenant-1", null, "900654", "Cliente", 1000, 1000]);
  assert.match(queries[0].sql, /report_resolve_pos_scope\(\$1::text, \$2::uuid, \$3::uuid, \$4::uuid, \$5::uuid\)/);
});

test("Customer master adapter treats blank document filter as no restriction", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return { rows: [{ count: "0" }] };
    },
  };
  const adapter = new CustomersReportAdapter({ executeFunction: async () => null } as never);
  await adapter.getCustomerMasterCount(actor, { tenantId: "tenant-1", customerDocument: "", customerName: "" }, client as never);
  assert.deepEqual(queries[0].params, ["ADMIN", "tenant-1", "branch-1", "tenant-1", null, null, null]);
  assert.match(queries[0].sql, /document_number_normalized/);
});
