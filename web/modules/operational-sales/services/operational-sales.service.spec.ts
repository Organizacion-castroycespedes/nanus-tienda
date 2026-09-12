import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleForElectronicBillingRequest } from "./operational-sales.service";

const sale = (overrides: Record<string, unknown> = {}) => ({
  status: "CONFIRMED",
  paymentStatus: "PAID",
  customer: { id: "customer-1", name: "Cliente QA" },
  electronicBilling: null,
  ...overrides,
});

test("electronic billing action is eligible only for paid confirmed sales without a document", () => {
  assert.equal(isEligibleForElectronicBillingRequest(sale()), true);
  assert.equal(isEligibleForElectronicBillingRequest(sale({ status: "DRAFT" })), false);
  assert.equal(isEligibleForElectronicBillingRequest(sale({ paymentStatus: "PENDING" })), false);
  assert.equal(
    isEligibleForElectronicBillingRequest(
      sale({ electronicBilling: { status: "PENDING" } })
    ),
    false
  );
});

test("electronic billing action requires a persisted customer reference", () => {
  assert.equal(
    isEligibleForElectronicBillingRequest(sale({ customer: { id: "" } })),
    false
  );
});
