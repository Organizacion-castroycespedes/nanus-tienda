import assert from "node:assert/strict";
import test from "node:test";
import { formatInventoryCurrency, formatInventoryUnits } from "./kpi-formatters";

test("formatInventoryCurrency keeps COP and formats decimal strings safely", () => {
  assert.equal(formatInventoryCurrency("158831520.0000"), "COP 158.831.520,00");
  assert.equal(formatInventoryCurrency("0"), "COP 0,00");
  assert.equal(formatInventoryCurrency("-1234.5"), "COP -1.234,50");
  assert.equal(formatInventoryCurrency("999999999999999999.999"), "COP 1.000.000.000.000.000.000,00");
});

test("formatInventoryUnits groups values and keeps up to two decimals", () => {
  assert.equal(formatInventoryUnits("9926.97"), "9.926,97");
  assert.equal(formatInventoryUnits("1000.00"), "1.000");
  assert.equal(formatInventoryUnits("-12.5"), "-12,5");
});

test("KPI formatters do not turn missing or invalid data into zero", () => {
  assert.equal(formatInventoryCurrency(null), null);
  assert.equal(formatInventoryUnits(undefined), null);
  assert.equal(formatInventoryCurrency("not-a-number"), null);
});
