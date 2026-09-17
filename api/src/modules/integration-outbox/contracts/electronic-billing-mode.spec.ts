import assert from "node:assert/strict";
import test from "node:test";
import { getElectronicBillingMode, resolveElectronicBillingPolicy } from "./electronic-billing-mode";

test("electronic billing mode defaults to automatic and accepts on-demand", () => {
  const previous = process.env.ELECTRONIC_BILLING_MODE;
  try {
    delete process.env.ELECTRONIC_BILLING_MODE;
    assert.equal(getElectronicBillingMode(), "AUTOMATIC");
    process.env.ELECTRONIC_BILLING_MODE = "ON_DEMAND";
    assert.equal(getElectronicBillingMode(), "ON_DEMAND");
    process.env.ELECTRONIC_BILLING_MODE = "invalid";
    assert.equal(getElectronicBillingMode(), "AUTOMATIC");
  } finally {
    if (previous === undefined) {
      delete process.env.ELECTRONIC_BILLING_MODE;
    } else {
      process.env.ELECTRONIC_BILLING_MODE = previous;
    }
  }
});

test("tenant billing policy defaults safely and honors backend config", () => {
  assert.deepEqual(resolveElectronicBillingPolicy(undefined), {
    enabled: true,
    mode: "AUTOMATIC",
  });
  assert.deepEqual(resolveElectronicBillingPolicy({ electronicBillingEnabled: false }), {
    enabled: false,
    mode: "AUTOMATIC",
  });
  assert.deepEqual(resolveElectronicBillingPolicy({ electronicBillingMode: "ON_DEMAND" }), {
    enabled: true,
    mode: "ON_DEMAND",
  });
});
