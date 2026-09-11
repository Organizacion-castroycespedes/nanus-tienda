import assert from "node:assert/strict";
import test from "node:test";
import { parseMode } from "../src/shared/config/peripherals.config";

test("peripheral mode parser accepts REAL and MOCK with safe fallback", () => {
  assert.equal(parseMode("REAL"), "REAL");
  assert.equal(parseMode("real"), "REAL");
  assert.equal(parseMode("MOCK"), "MOCK");
  assert.equal(parseMode("invalid"), "MOCK");
  assert.equal(parseMode(undefined), "MOCK");
});
