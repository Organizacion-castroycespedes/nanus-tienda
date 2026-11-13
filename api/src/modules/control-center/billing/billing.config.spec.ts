import assert from "node:assert/strict";
import test from "node:test";
import { readBillingConfig } from "./billing.config";

test("billing config defaults: worker off, 5 lead days, 5 MB", () => {
  assert.deepEqual(readBillingConfig({}), {
    workerEnabled: false,
    workerIntervalMs: 3_600_000,
    leadDays: 5,
    receiptMaxSizeBytes: 5 * 1024 * 1024,
  });
});

test("billing config reads valid values and ignores out-of-range ones", () => {
  const config = readBillingConfig({
    CONTROL_CENTER_BILLING_WORKER_ENABLED: "TRUE",
    CONTROL_CENTER_BILLING_WORKER_INTERVAL_MS: "600000",
    CONTROL_CENTER_BILLING_LEAD_DAYS: "7",
    CONTROL_CENTER_RECEIPT_MAX_SIZE_MB: "50",
  });
  assert.equal(config.workerEnabled, true);
  assert.equal(config.workerIntervalMs, 600_000);
  assert.equal(config.leadDays, 7);
  assert.equal(config.receiptMaxSizeBytes, 5 * 1024 * 1024);
  assert.equal(readBillingConfig({ CONTROL_CENTER_BILLING_WORKER_INTERVAL_MS: "10" }).workerIntervalMs, 3_600_000);
});
