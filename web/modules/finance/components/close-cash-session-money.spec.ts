import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCashAmountForInput,
  parseCashAmountInput,
  sanitizeCashAmountInput,
} from "./close-cash-session-money";

test("cash amount parser accepts zero, integers and decimals", () => {
  assert.equal(parseCashAmountInput("$0"), 0);
  assert.equal(parseCashAmountInput("$1000"), 1000);
  assert.equal(parseCashAmountInput("$1000.50"), 1000.5);
  assert.equal(parseCashAmountInput("$123456.75"), 123456.75);
});

test("cash amount parser keeps at most two decimals and stays numeric", () => {
  assert.equal(sanitizeCashAmountInput("$123.456"), "123.45");
  assert.equal(parseCashAmountInput("$123.456"), 123.45);
  assert.equal(parseCashAmountInput("invalid"), 0);
});

test("cash amount formatter avoids invalid display values", () => {
  assert.equal(formatCashAmountForInput(Number.NaN), "0");
  assert.equal(formatCashAmountForInput(-10), "0");
  assert.equal(formatCashAmountForInput(1000.5), "1000.5");
});
