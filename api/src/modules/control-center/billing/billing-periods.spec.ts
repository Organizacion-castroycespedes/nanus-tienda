import assert from "node:assert/strict";
import test from "node:test";
import {
  billingStartOf,
  chargeStatusFor,
  computeProration,
  periodContaining,
  planAutoAllocation,
  planCharges,
  prorationAmounts,
  type BillableContract,
  type BillableItem,
  type BillableVersion,
} from "./billing-periods";

const item = (over: Partial<BillableItem>): BillableItem => ({
  id: over.id ?? `i-${Math.random()}`,
  itemType: "BASE",
  description: "Plan",
  quantity: "1.00",
  unitAmount: "850000.00",
  discountAmount: "0.00",
  billingFrequency: "ANNUAL",
  ...over,
});

const version = (over: Partial<BillableVersion>): BillableVersion => ({
  id: "v1",
  versionNo: 1,
  effectiveFrom: "2026-12-15",
  effectiveTo: null,
  billingAnchorDay: 15,
  trialEndsOn: "2027-01-15",
  prorationPolicy: "DAILY",
  taxName: "IVA 19%",
  taxRate: "0.1900",
  pricesIncludeTax: true,
  items: [],
  ...over,
});

const initialItems = [
  item({ id: "base" }),
  item({ id: "cert", itemType: "CERTIFICATION", unitAmount: "119000.00", discountAmount: "119000.00" }),
];

const annualContract = (): BillableContract => ({
  id: "c1",
  startDate: "2026-12-15",
  endDate: null,
  versions: [version({ items: initialItems })],
});

test("billing starts when the trial ends", () => {
  assert.equal(billingStartOf(annualContract()), "2027-01-15");
  const noTrial = annualContract();
  noTrial.versions[0].trialEndsOn = null;
  assert.equal(billingStartOf(noTrial), "2026-12-15");
});

test("no charges are planned during the trial", () => {
  assert.deepEqual(planCharges(annualContract(), "2027-01-14"), []);
});

test("first annual charge: 850.000 IVA incluido, certificación bonificada", () => {
  const [charge, ...rest] = planCharges(annualContract(), "2027-01-20");
  assert.equal(rest.length, 0);
  assert.equal(charge.kind, "PERIOD");
  assert.equal(charge.billingFrequency, "ANNUAL");
  assert.equal(charge.periodStart, "2027-01-15");
  assert.equal(charge.periodEnd, "2028-01-14");
  assert.equal(charge.dueDate, "2027-01-15");
  assert.deepEqual(charge.amounts, {
    subtotal: "969000.00",
    discountTotal: "119000.00",
    base: "714286.00",
    tax: "135714.00",
    total: "850000.00",
  });
  assert.equal(charge.lines.length, 2);
});

test("planning twice yields the same periods (idempotent input for the unique index)", () => {
  const a = planCharges(annualContract(), "2029-02-01").map((c) => `${c.billingFrequency}:${c.periodStart}`);
  const b = planCharges(annualContract(), "2029-02-01").map((c) => `${c.billingFrequency}:${c.periodStart}`);
  assert.deepEqual(a, b);
  assert.deepEqual(a, ["ANNUAL:2027-01-15", "ANNUAL:2028-01-15", "ANNUAL:2029-01-15"]);
});

test("monthly periods keep the end-of-month anchor", () => {
  const contract: BillableContract = {
    id: "c2",
    startDate: "2027-01-31",
    endDate: null,
    versions: [
      version({
        effectiveFrom: "2027-01-31",
        billingAnchorDay: 31,
        trialEndsOn: null,
        items: [item({ billingFrequency: "MONTHLY", unitAmount: "99900.00" })],
      }),
    ],
  };
  const starts = planCharges(contract, "2027-04-30").map((c) => c.periodStart);
  assert.deepEqual(starts, ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  const ends = planCharges(contract, "2027-04-30").map((c) => c.periodEnd);
  assert.deepEqual(ends.slice(0, 2), ["2027-02-27", "2027-03-30"]);
});

test("trial clamped to February keeps day 31 afterwards", () => {
  const contract: BillableContract = {
    id: "c3",
    startDate: "2027-01-31",
    endDate: null,
    versions: [
      version({
        effectiveFrom: "2027-01-31",
        billingAnchorDay: 31,
        trialEndsOn: "2027-02-28",
        items: [item({ billingFrequency: "MONTHLY", unitAmount: "99900.00" })],
      }),
    ],
  };
  assert.deepEqual(planCharges(contract, "2027-03-31").map((c) => c.periodStart), ["2027-02-28", "2027-03-31"]);
});

test("monthly renewal charges plan monthly and certification yearly", () => {
  const contract = annualContract();
  contract.versions[0].effectiveTo = "2028-01-14";
  contract.versions.push(
    version({
      id: "v2",
      versionNo: 2,
      effectiveFrom: "2028-01-15",
      items: [
        item({ id: "renew", billingFrequency: "MONTHLY", unitAmount: "99900.00" }),
        item({ id: "cert2", itemType: "CERTIFICATION", unitAmount: "119000.00" }),
      ],
    }),
  );
  const charges = planCharges(contract, "2028-03-15").map((c) => `${c.billingFrequency}:${c.periodStart}:${c.amounts.total}`);
  assert.deepEqual(charges, [
    "ANNUAL:2027-01-15:850000.00",
    "ANNUAL:2028-01-15:119000.00",
    "MONTHLY:2028-01-15:99900.00",
    "MONTHLY:2028-02-15:99900.00",
    "MONTHLY:2028-03-15:99900.00",
  ]);
});

test("zero total charges are planned (they are recorded as PAID)", () => {
  const contract = annualContract();
  contract.versions[0].items = [item({ discountAmount: "850000.00" })];
  const [charge] = planCharges(contract, "2027-01-15");
  assert.equal(charge.amounts.total, "0.00");
  assert.equal(chargeStatusFor(0n, 0n), "PAID");
});

test("no period starting after the contract end is planned", () => {
  const contract = annualContract();
  contract.versions[0].items = [item({ billingFrequency: "MONTHLY", unitAmount: "99900.00" })];
  contract.endDate = "2027-06-30";
  const starts = planCharges(contract, "2028-01-01").map((c) => c.periodStart);
  assert.equal(starts.at(-1), "2027-06-15");
  assert.equal(starts.length, 6);
});

test("one-time items are charged once per version when billing starts", () => {
  const contract = annualContract();
  contract.versions[0].items = [...initialItems, item({ id: "setup", itemType: "CUSTOM", billingFrequency: "ONE_TIME", unitAmount: "200000.00" })];
  const oneTime = planCharges(contract, "2028-06-01").filter((c) => c.kind === "ONE_TIME");
  assert.equal(oneTime.length, 1);
  assert.equal(oneTime[0].periodStart, "2027-01-15");
  assert.equal(oneTime[0].amounts.total, "200000.00");
});

test("proration: extra annual terminal added mid-year", () => {
  const contract = annualContract();
  const previous = contract.versions[0];
  const next = version({
    id: "v2",
    versionNo: 2,
    effectiveFrom: "2027-07-15",
    items: [...initialItems, item({ id: "extra", itemType: "EXTRA_POS_TERMINAL", unitAmount: "350000.00" })],
  });
  const result = computeProration(contract, previous, next, "2027-07-15", "ANNUAL");
  assert.ok(result);
  assert.equal(result.periodStart, "2027-07-15");
  assert.equal(result.periodEnd, "2028-01-14");
  assert.equal(result.remainingDays, 184);
  assert.equal(result.totalDays, 365);
  assert.equal(result.factor, "0.504110");
  // 350000 * 184 / 365 = 176438.36 -> 176438
  assert.equal(result.proratedCents, 17643800n);
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].itemType, "EXTRA_POS_TERMINAL");
  assert.equal(prorationAmounts(result, next).total, "176438.00");
});

test("proration: reduction yields a negative amount (credit)", () => {
  const contract = annualContract();
  contract.versions[0].items = [...initialItems, item({ id: "extra", itemType: "EXTRA_POS_TERMINAL", unitAmount: "350000.00" })];
  const next = version({ id: "v2", versionNo: 2, effectiveFrom: "2027-07-15", items: initialItems });
  const result = computeProration(contract, contract.versions[0], next, "2027-07-15", "ANNUAL");
  assert.ok(result);
  assert.equal(result.proratedCents, -17643800n);
  assert.equal(result.lines[0].lineTotal.startsWith("-"), true);
});

test("proration: none at the start of a period, during trial or without changes", () => {
  const contract = annualContract();
  const next = version({ id: "v2", versionNo: 2, effectiveFrom: "2028-01-15", items: [item({ unitAmount: "900000.00" })] });
  assert.equal(computeProration(contract, contract.versions[0], next, "2028-01-15", "ANNUAL"), null);
  assert.equal(computeProration(contract, contract.versions[0], next, "2027-01-01", "ANNUAL"), null);
  assert.equal(computeProration(contract, contract.versions[0], version({ items: initialItems }), "2027-03-01", "ANNUAL"), null);
});

test("proration: monthly item added inside an annual-only version", () => {
  const contract = annualContract();
  const next = version({
    id: "v2",
    versionNo: 2,
    effectiveFrom: "2027-03-01",
    items: [...initialItems, item({ id: "m", itemType: "EXTRA_POS_TERMINAL", billingFrequency: "MONTHLY", unitAmount: "29900.00" })],
  });
  const result = computeProration(contract, contract.versions[0], next, "2027-03-01", "MONTHLY");
  assert.ok(result);
  assert.equal(result.periodEnd, "2027-03-14");
  // 29900 * 14 / 28 = 14950
  assert.equal(result.proratedCents, 1495000n);
});

test("periodContaining returns null before billing", () => {
  assert.equal(periodContaining(annualContract(), "ANNUAL", "2027-01-01"), null);
  assert.deepEqual(periodContaining(annualContract(), "ANNUAL", "2028-02-01"), { start: "2028-01-15", end: "2029-01-14", index: 1 });
});

test("charge status and auto allocation oldest first", () => {
  assert.equal(chargeStatusFor(85000000n, 0n), "OPEN");
  assert.equal(chargeStatusFor(85000000n, 40000000n), "PARTIALLY_PAID");
  assert.equal(chargeStatusFor(85000000n, 85000000n), "PAID");
  const plan = planAutoAllocation(120000000n, [
    { id: "a", balanceCents: 85000000n },
    { id: "b", balanceCents: 35000000n },
    { id: "c", balanceCents: 10000000n },
  ]);
  assert.deepEqual(plan.allocations, [
    { chargeId: "a", amountCents: 85000000n },
    { chargeId: "b", amountCents: 35000000n },
  ]);
  assert.equal(plan.unallocatedCents, 0n);
  assert.equal(planAutoAllocation(5000n, [{ id: "a", balanceCents: 10000n }]).allocations[0].amountCents, 5000n);
  assert.equal(planAutoAllocation(5000n, []).unallocatedCents, 5000n);
});
