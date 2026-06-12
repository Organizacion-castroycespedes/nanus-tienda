import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { SalesReportAdapter } from "./sales-report.adapter";

function readMigration(fileName: string) {
  const candidates = [
    resolve(process.cwd(), "..", "scripts", "database", "migrations", fileName),
    resolve(process.cwd(), "scripts", "database", "migrations", fileName),
  ];
  const filePath = candidates.find((candidate) => existsSync(candidate));

  if (!filePath) {
    throw new Error(`Migration not found: ${fileName}`);
  }

  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

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
  assert.equal(calls[0].params.length, 8);
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

test("V061 report_pos_sales: elimina overload legacy y conserva firma del adapter", () => {
  const sql = readMigration("V061__drop_legacy_report_pos_sales_overload.sql");

  assert.match(
    sql,
    /DROP FUNCTION IF EXISTS public\.report_pos_sales\(\s*UUID,\s*TEXT,\s*UUID,\s*UUID,\s*UUID,\s*UUID,\s*TIMESTAMPTZ,\s*TIMESTAMPTZ,\s*TEXT,\s*TEXT\s*\);/i
  );
  assert.match(
    sql,
    /public\.report_pos_sales\(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz\)/
  );
  assert.match(
    sql,
    /public\.report_pos_sales\(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text\)/
  );
  assert.match(sql, /legacy report_pos_sales extended overload still exists/);
  assert.match(sql, /report_pos_sales overload count expected 1/);
});
