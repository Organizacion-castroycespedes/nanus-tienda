import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

const readMigration = (fileName: string) =>
  readFileSync(resolve(repoRoot, "scripts/database/migrations", fileName), "utf8");

test("V059 normaliza constraints legacy de purchases.status", () => {
  const sql = readMigration(
    "V059__purchase_status_constraint_partial_liquidation_drift_fix.sql"
  );

  assert.match(sql, /DROP CONSTRAINT IF EXISTS purchases_status_check/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS chk_purchases_status/);
  assert.match(sql, /ADD CONSTRAINT chk_purchases_status/);
  assert.match(sql, /'CERRADA_PARCIAL'/);
});

test("V060 restaura report_pos_sales con firma esperada por adapter", () => {
  const sql = readMigration("V060__restore_report_pos_sales_signature.sql");

  assert.match(sql, /DROP FUNCTION IF EXISTS public\.report_pos_sales/);
  assert.match(sql, /p_actor_user_id UUID/);
  assert.match(sql, /p_actor_role TEXT/);
  assert.match(sql, /p_actor_tenant_id UUID/);
  assert.match(sql, /p_actor_branch_id UUID/);
  assert.match(sql, /p_tenant_id UUID DEFAULT NULL/);
  assert.match(sql, /p_branch_id UUID DEFAULT NULL/);
  assert.match(sql, /p_date_from TIMESTAMPTZ DEFAULT NULL/);
  assert.match(sql, /p_date_to TIMESTAMPTZ DEFAULT NULL/);
  assert.match(sql, /pg_get_function_arguments/);
});
