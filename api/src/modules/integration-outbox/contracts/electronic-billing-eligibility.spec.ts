import assert from "node:assert/strict";
import test from "node:test";
import { evaluateElectronicBillingEligibility } from "./electronic-billing-eligibility";

const base = {
  saleStatus: "CONFIRMED",
  paymentStatus: "PAID",
  customerId: "customer-1",
  documentStatuses: [],
  requestExists: false,
};

test("electronic billing eligibility is canonical and fail closed", () => {
  assert.equal(evaluateElectronicBillingEligibility(base), "ELIGIBLE");
  assert.equal(
    evaluateElectronicBillingEligibility({ ...base, documentStatuses: ["ACCEPTED"] }),
    "ALREADY_ACCEPTED",
  );
  assert.equal(
    evaluateElectronicBillingEligibility({ ...base, documentStatuses: ["PROCESSING"] }),
    "PROCESSING",
  );
  assert.equal(
    evaluateElectronicBillingEligibility({ ...base, documentStatuses: ["REJECTED"] }),
    "REJECTED",
  );
  assert.equal(
    evaluateElectronicBillingEligibility({ ...base, documentStatuses: ["PENDING"] }),
    "ALREADY_REQUESTED",
  );
  assert.equal(
    evaluateElectronicBillingEligibility({ ...base, documentStatuses: ["PENDING", "ACCEPTED"] }),
    "AMBIGUOUS_DOCUMENT",
  );
  assert.equal(
    evaluateElectronicBillingEligibility({ ...base, saleStatus: "CANCELLED" }),
    "CANCELLED",
  );
  assert.equal(
    evaluateElectronicBillingEligibility({ ...base, customerId: null }),
    "NO_CUSTOMER",
  );
});

test("IVA billing rejects an incomplete final-consumer fiscal profile", () => {
  assert.equal(
    evaluateElectronicBillingEligibility({
      ...base,
      hasTaxLines: true,
      customerFiscalDataComplete: false,
    }),
    "INCOMPLETE_CUSTOMER_FISCAL_DATA",
  );
});

test("no-tax billing keeps the existing final-consumer exception", () => {
  assert.equal(
    evaluateElectronicBillingEligibility({
      ...base,
      hasTaxLines: false,
      customerFiscalDataComplete: false,
    }),
    "ELIGIBLE",
  );
});
