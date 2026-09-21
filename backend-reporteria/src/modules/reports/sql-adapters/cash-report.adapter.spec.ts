import assert from "node:assert/strict";
import test from "node:test";
import { CashReportAdapter } from "./cash-report.adapter";

const actor = {
  userId: "user-1",
  role: "USER",
  tenantId: "tenant-1",
  branchId: "branch-1",
};

const filters = {
  tenantId: "tenant-1",
  branchId: "branch-1",
  dateFrom: "2026-09-01T00:00:00.000Z",
  dateTo: "2026-09-21T00:00:00.000Z",
};

test("CashReportAdapter export de cierres usa count y batch con scope real", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return queries.length === 1
        ? { rows: [{ count: "1001" }] }
        : { rows: [{ cashSessionId: "session-1", openingAmount: "10", totalIn: "20", totalOut: "5", expectedAmount: "25", closingAmount: "25", difference: "0" }] };
    },
  };
  const adapter = new CashReportAdapter({ executeFunction: async () => null } as never, { query: async () => ({ rows: [] }) } as never);

  const count = await adapter.getCashClosingsExportCount(actor, filters, client as never);
  const rows = await adapter.getCashClosingsExportBatch(actor, filters, client as never, 1000, 1000);

  assert.equal(count, 1001);
  assert.equal(rows[0]?.openingAmount, 10);
  assert.match(queries[0].sql, /report_resolve_pos_scope\(/);
  assert.match(queries[0].sql, /COUNT\(\*\)/);
  assert.match(queries[1].sql, /LIMIT \$9::integer OFFSET \$10::integer/);
  assert.deepEqual(queries[0].params, ["user-1", "USER", "tenant-1", "branch-1", "tenant-1", "branch-1", filters.dateFrom, filters.dateTo]);
});

test("CashReportAdapter export de arqueos preserva actor, fechas y orden batchable", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return queries.length === 1
        ? { rows: [{ count: "1" }] }
        : { rows: [{ cashCountId: "count-1", countedAmount: "100", expectedAmount: "90", difference: "10" }] };
    },
  };
  const adapter = new CashReportAdapter({ executeFunction: async () => null } as never, { query: async () => ({ rows: [] }) } as never);

  assert.equal(await adapter.getCashAuditsExportCount(actor, filters, client as never), 1);
  const rows = await adapter.getCashAuditsExportBatch(actor, filters, client as never, 0, 1000);

  assert.equal(rows[0]?.difference, 10);
  assert.match(queries[0].sql, /cash_counts/);
  assert.match(queries[1].sql, /ORDER BY count_data.counted_at DESC, count_data.id DESC/);
  assert.deepEqual(queries[1].params.slice(-2), [1000, 0]);
});

test("CashReportAdapter branding omite datos no disponibles sin inventarlos", async () => {
  const adapter = new CashReportAdapter({ executeFunction: async () => null } as never, {
    query: async () => ({ rows: [{ tenantName: "Tenant Real", config: {}, legalName: null, nit: null, branchName: null }] }),
  } as never);

  const branding = await adapter.getPrintableCompany(actor);
  assert.equal(branding.tenantName, "Tenant Real");
  assert.equal(branding.legalName, "Tenant Real");
  assert.equal(branding.nit, null);
  assert.equal(branding.logo, null);
});
