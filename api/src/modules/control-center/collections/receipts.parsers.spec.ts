import assert from "node:assert/strict";
import test from "node:test";
import { parseAllocationBody, parseAllocationList, parseReceiptCreate } from "./receipts.parsers";

const ACCOUNT = "44444444-0000-0000-0000-000000000001";
const METHOD = "33333333-0000-0000-0000-000000000001";
const CHARGE = "c0000000-0000-0000-0000-000000000001";

const code = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (error: any) {
    return error.getResponse().code;
  }
};

test("parses a multipart receipt with JSON allocations", () => {
  const input = parseReceiptCreate({
    accountId: ACCOUNT,
    receivedOn: "2027-01-15",
    amount: "850000",
    paymentMethodId: METHOD,
    reference: " TRX-1 ",
    allocations: JSON.stringify([{ chargeId: CHARGE, amount: "400000.00" }]),
  });
  assert.equal(input.amountCents, 85000000n);
  assert.equal(input.reference, "TRX-1");
  assert.deepEqual(input.allocations, [{ chargeId: CHARGE, amountCents: 40000000n }]);
  assert.equal(input.autoAllocate, false);
  assert.equal(input.financialInstitutionId, null);
});

test("autoAllocate accepts form strings", () => {
  const input = parseReceiptCreate({ accountId: ACCOUNT, receivedOn: "2027-01-15", amount: 1000, paymentMethodId: METHOD, autoAllocate: "true" });
  assert.equal(input.autoAllocate, true);
});

test("rejects zero amounts, bad dates and mixing manual with automatic allocation", () => {
  const base = { accountId: ACCOUNT, receivedOn: "2027-01-15", amount: "1000", paymentMethodId: METHOD };
  assert.equal(code(() => parseReceiptCreate({ ...base, amount: "0" })), "CONTROL_CENTER_INVALID_AMOUNT");
  assert.equal(code(() => parseReceiptCreate({ ...base, receivedOn: "2027-02-30" })), "CONTROL_CENTER_INVALID_DATE");
  assert.equal(
    code(() => parseReceiptCreate({ ...base, autoAllocate: true, allocations: [{ chargeId: CHARGE, amount: "1" }] })),
    "CONTROL_CENTER_INVALID_FIELD",
  );
  assert.equal(code(() => parseAllocationList("not json")), "CONTROL_CENTER_INVALID_FIELD");
  assert.equal(code(() => parseAllocationList([{ chargeId: "x", amount: "1" }])), "CONTROL_CENTER_INVALID_ID");
});

test("allocation body requires exactly one mode", () => {
  assert.equal(code(() => parseAllocationBody({})), "CONTROL_CENTER_INVALID_FIELD");
  assert.equal(parseAllocationBody({ autoAllocate: true }).autoAllocate, true);
  assert.equal(parseAllocationBody({ allocations: [{ chargeId: CHARGE, amount: "5" }] }).allocations.length, 1);
});
