import assert from "node:assert/strict";
import test from "node:test";
import {
  CERTIFICATION_BONUS,
  buildContractItems,
  contractedPosTerminals,
  summarizeItems,
  type PriceComponent,
} from "./contract-items";

const proposal: PriceComponent[] = [
  { component: "BASE_INITIAL_TERM", billingFrequency: "ANNUAL", amount: "850000.00" },
  { component: "BASE_RENEWAL", billingFrequency: "MONTHLY", amount: "99900.00" },
  { component: "BASE_RENEWAL", billingFrequency: "ANNUAL", amount: "850000.00" },
  { component: "EXTRA_POS_TERMINAL", billingFrequency: "MONTHLY", amount: "29900.00" },
  { component: "EXTRA_POS_TERMINAL", billingFrequency: "ANNUAL", amount: "350000.00" },
  { component: "CERTIFICATION", billingFrequency: "ANNUAL", amount: "119000.00" },
];

test("items: initial annual term with extras and certification included", () => {
  const { items, priceAdjusted } = buildContractItems(proposal, {
    termPhase: "INITIAL",
    billingFrequency: "ANNUAL",
    extraPosTerminals: 2,
    customItems: [],
  });
  assert.equal(priceAdjusted, false);
  assert.deepEqual(
    items.map((i) => [i.itemType, i.quantity, i.unitAmount, i.discountAmount, i.billingFrequency]),
    [
      ["BASE", "1.00", "850000.00", "0.00", "ANNUAL"],
      ["EXTRA_POS_TERMINAL", "2.00", "350000.00", "0.00", "ANNUAL"],
      ["CERTIFICATION", "1.00", "119000.00", "119000.00", "ANNUAL"],
    ],
  );
  assert.equal(items[2].metadata.bonus, CERTIFICATION_BONUS.INITIAL);
  assert.equal(contractedPosTerminals(1, items), 3);
});

test("items: monthly renewal charges certification separately", () => {
  const { items } = buildContractItems(proposal, {
    termPhase: "RENEWAL",
    billingFrequency: "MONTHLY",
    extraPosTerminals: 0,
    customItems: [],
  });
  assert.equal(items[0].unitAmount, "99900.00");
  const certification = items.find((i) => i.itemType === "CERTIFICATION")!;
  assert.equal(certification.discountAmount, "0.00");
  assert.equal(certification.billingFrequency, "ANNUAL");
});

test("items: annual renewal keeps loyalty bonus visible", () => {
  const { items } = buildContractItems(proposal, {
    termPhase: "RENEWAL",
    billingFrequency: "ANNUAL",
    extraPosTerminals: 0,
    customItems: [],
  });
  const certification = items.find((i) => i.itemType === "CERTIFICATION")!;
  assert.equal(certification.discountAmount, "119000.00");
  assert.equal(certification.metadata.bonus, CERTIFICATION_BONUS.ANNUAL_RENEWAL);
});

test("items: missing component is a 422", () => {
  assert.throws(
    () =>
      buildContractItems(proposal, {
        termPhase: "INITIAL",
        billingFrequency: "MONTHLY",
        extraPosTerminals: 0,
        customItems: [],
      }),
    (error: any) => error.getResponse?.().code === "CONTROL_CENTER_PRICE_COMPONENT_MISSING",
  );
});

test("items: overrides mark the contract as price-adjusted and keep catalog trace", () => {
  const { items, priceAdjusted } = buildContractItems(proposal, {
    termPhase: "INITIAL",
    billingFrequency: "ANNUAL",
    extraPosTerminals: 0,
    customItems: [],
    overrides: { BASE: { unitAmount: "800000.00" } },
  });
  assert.equal(priceAdjusted, true);
  assert.equal(items[0].unitAmount, "800000.00");
  assert.equal(items[0].metadata.catalogUnitAmount, "850000.00");
});

test("items: custom items (sede adicional) and discount guard", () => {
  const { items } = buildContractItems(proposal, {
    termPhase: "INITIAL",
    billingFrequency: "ANNUAL",
    extraPosTerminals: 0,
    customItems: [
      { description: "Sede adicional", quantity: "1.00", unitAmount: "200000.00", billingFrequency: "ANNUAL", discountAmount: "0.00" },
    ],
  });
  assert.equal(items.at(-1)?.itemType, "CUSTOM");
  assert.throws(
    () =>
      buildContractItems(proposal, {
        termPhase: "INITIAL",
        billingFrequency: "ANNUAL",
        extraPosTerminals: 0,
        customItems: [
          { description: "Capacitación", quantity: "1.00", unitAmount: "100.00", billingFrequency: "ONE_TIME", discountAmount: "200.00" },
        ],
      }),
    /descuento/,
  );
});

test("items: summary shows VAT-included totals per frequency", () => {
  const { items } = buildContractItems(proposal, {
    termPhase: "INITIAL",
    billingFrequency: "ANNUAL",
    extraPosTerminals: 0,
    customItems: [],
  });
  const summary = summarizeItems(items, "0.1900", true);
  assert.deepEqual(summary.ANNUAL, {
    subtotal: "850000.00",
    base: "714286.00",
    tax: "135714.00",
    total: "850000.00",
  });
});
