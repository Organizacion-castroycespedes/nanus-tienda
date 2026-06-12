import assert from "node:assert/strict";
import test from "node:test";
import { SalesReportAdapter } from "./sales-report.adapter";

test("SalesReportAdapter.getSalesList: llama report_pos_sales con firma esperada", async () => {
  const calls: Array<{ name: string; params: unknown[] }> = [];
  const adapter = new SalesReportAdapter({
    executeFunction: async (name: string, params: unknown[]) => {
      calls.push({ name, params });
      return null;
    },
  } as never);

  await adapter.getSalesList(
    {
      userId: "40000000-0000-0000-0000-000000000001",
      role: "SUPER_ADMIN",
      tenantId: "00000000-0000-0000-0000-000000000001",
      branchId: "30000000-0000-0000-0000-000000000001",
    },
    {
      tenantId: "00000000-0000-0000-0000-000000000001",
      branchId: "30000000-0000-0000-0000-000000000001",
      dateFrom: "2026-06-11T00:00:00.000Z",
      dateTo: "2026-06-13T00:00:00.000Z",
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "report_pos_sales");
  assert.deepEqual(calls[0].params, [
    "40000000-0000-0000-0000-000000000001",
    "SUPER_ADMIN",
    "00000000-0000-0000-0000-000000000001",
    "30000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000001",
    "30000000-0000-0000-0000-000000000001",
    "2026-06-11T00:00:00.000Z",
    "2026-06-13T00:00:00.000Z",
  ]);
});
