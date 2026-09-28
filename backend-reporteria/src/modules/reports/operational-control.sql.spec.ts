import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "../scripts/database/migrations/V095__reporteria_operational_control.sql"), "utf8");

test("operational control SQL keeps invoker security and bounded attributed details", () => {
  assert.match(migration, /LANGUAGE plpgsql STABLE SECURITY INVOKER/);
  assert.match(migration, /'filterOptions'/);
  assert.match(migration, /'details'/);
  assert.match(migration, /LIMIT 8/);
  assert.match(migration, /p_requested_terminal_id/);
  assert.match(migration, /p_requested_cashier_id/);
});
