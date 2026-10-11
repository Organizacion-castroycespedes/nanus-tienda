import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(
  resolve(process.cwd(), "../scripts/database/migrations/V104__capture_backed_weighted_pos_sale.sql"),
  "utf8",
);
const functionStart = migration.indexOf(
  "CREATE OR REPLACE FUNCTION public.inventory_create_sale_v2(",
);
assert.notEqual(functionStart, -1);
const saleFunction = migration.slice(functionStart);
const schemaChanges = migration.slice(0, functionStart);

test("V104 preserves scale 3 for weighted sale, movement, lots, and order quantities", () => {
  for (const column of [
    "sale_items.quantity",
    "stock_movements.quantity",
    "stock_movements.stock_before",
    "stock_movements.stock_after",
    "inventory_lot_balances.quantity_on_hand",
    "inventory_lot_balances.quantity_reserved",
    "stock_movement_lots.quantity",
    "order_items.ordered_quantity",
    "order_items.delivered_quantity",
    "order_items.billed_quantity",
  ]) {
    const [table, name] = column.split(".");
    assert.match(
      schemaChanges,
      new RegExp(`ALTER TABLE public\\.${table}[\\s\\S]*?ALTER COLUMN ${name} TYPE NUMERIC\\(14, 3\\)`),
    );
  }

  assert.match(schemaChanges, /quantity_available NUMERIC\(14, 3\)\s+GENERATED ALWAYS AS \(quantity_on_hand - quantity_reserved\) STORED/);
  assert.match(schemaChanges, /raw_weight_kg NUMERIC\(18, 6\)/);
  assert.match(schemaChanges, /commercial_quantity_kg NUMERIC\(14, 3\)/);
  assert.match(schemaChanges, /CHECK \(commercial_quantity_kg = ROUND\(raw_weight_kg, 3\)\)/);
});

test("V104 carries three decimals through the active sale function and correlations", () => {
  assert.match(saleFunction, /item\.quantity::NUMERIC AS quantity/);
  assert.match(saleFunction, /WHEN v_item\.sale_mode = 'WEIGHT' THEN ROUND\(v_item\.quantity, 3\)[\s\S]*ELSE ROUND\(v_item\.quantity, 2\)/);
  assert.match(saleFunction, /ROUND\(v_stock_before - v_quantity, 3\)/);
  assert.match(saleFunction, /LEAST\(v_remaining_lot_quantity, v_lot_balance\.quantity_available\),\s+3\s+\)/);
  assert.match(saleFunction, /v_remaining_lot_quantity - v_quantity_from_lot,\s+3\s+\)/);
  assert.doesNotMatch(saleFunction, /(?:item\.quantity|v_item\.quantity|v_stock_before - v_quantity)::?NUMERIC\([^)]*,\s*2\)|ROUND\(v_stock_before - v_quantity, 2\)/);
  assert.equal((saleFunction.match(/v_item\.sale_mode,/g) ?? []).length, 2);
  assert.match(saleFunction, /COALESCE\(v_item\.sale_item_id, gen_random_uuid\(\)\)/);
  assert.match(schemaChanges, /FOREIGN KEY \(tenant_id, sale_id, sale_item_id\)[\s\S]*REFERENCES public\.sale_items \(tenant_id, sale_id, id\)/);
  assert.match(schemaChanges, /FOREIGN KEY \(tenant_id, capture_id\)[\s\S]*REFERENCES public\.terminal_scale_weight_captures \(tenant_id, capture_id\)/);
});

test("V104 leaves monetary precision, subtotal constraints, fiscal columns, and product thresholds untouched", () => {
  assert.match(saleFunction, /v_total NUMERIC\(12, 2\)/);
  assert.match(saleFunction, /v_subtotal NUMERIC\(12, 2\)/);
  assert.doesNotMatch(schemaChanges, /ADD CONSTRAINT chk_sale_items_subtotal_matches/);
  assert.doesNotMatch(schemaChanges, /ALTER COLUMN (?:min_stock|max_stock|tax_base|tax_amount|tax_total)/i);
});
