import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { PricingService } from "./pricing.service";
import type {
  PricingProductSnapshot,
  PricingProductTaxProfileSnapshot,
  PricingProductTaxSnapshot,
  PricingPromotionSnapshot,
} from "./pricing.types";

const tenantId = randomUUID();
const branchId = randomUUID();
const productId = randomUUID();

const productTax = (
  overrides: Partial<PricingProductTaxSnapshot> = {}
): PricingProductTaxSnapshot => ({
  taxId: randomUUID(),
  taxName: "IVA",
  dianCode: null,
  taxTypeCode: null,
  calculationMethodCode: "PERCENTAGE",
  taxBaseTypeCode: null,
  calculationOrder: 1,
  isIncluded: false,
  rate: 0.19,
  percentageRate: 0.19,
  fixedAmount: null,
  baseQuantity: null,
  baseUnitCode: null,
  ...overrides,
});

const taxProfile = (
  overrides: Partial<PricingProductTaxProfileSnapshot> = {}
): PricingProductTaxProfileSnapshot => ({
  taxProductCategoryId: randomUUID(),
  alcoholDegree: null,
  netVolumeMl: null,
  daneCertifiedRetailPrice: null,
  ...overrides,
});

const baseProduct = (
  overrides: Partial<PricingProductSnapshot> = {}
): PricingProductSnapshot => {
  const merged: PricingProductSnapshot = {
    id: productId,
    tenantId,
    price: 119,
    taxId: null,
    taxRate: 0,
    taxIsIncluded: false,
    taxes: [],
    taxProfile: null,
    isActive: true,
    ...overrides,
  };

  if (overrides.taxes !== undefined) {
    return merged;
  }

  if (!merged.taxId && merged.taxRate <= 0) {
    return merged;
  }

  const syntheticTaxId = merged.taxId ?? randomUUID();

  return {
    ...merged,
    taxId: syntheticTaxId,
    taxes: [
      productTax({
        taxId: syntheticTaxId,
        taxName: "Bridge Tax",
        isIncluded: merged.taxIsIncluded,
        rate: merged.taxRate,
        percentageRate: merged.taxRate,
      }),
    ],
  };
};

const promotion = (
  overrides: Partial<PricingPromotionSnapshot> = {}
): PricingPromotionSnapshot => ({
  id: randomUUID(),
  name: "Promo QA",
  discountType: "PERCENTAGE",
  discountValue: 10,
  priority: 100,
  createdAt: new Date("2026-06-01T10:00:00.000Z"),
  ...overrides,
});

const buildService = (
  product: PricingProductSnapshot | null,
  promotions: PricingPromotionSnapshot[] = []
) => {
  const calls: string[] = [];
  const repository = {
    findProductSnapshot: async (
      inputTenantId: string,
      inputProductId: string
    ) => {
      calls.push(`find:${inputTenantId}:${inputProductId}`);
      return product;
    },
    findApplicablePromotions: async (input: {
      tenantId: string;
      branchId: string;
      productId: string;
      date: Date;
    }) => {
      calls.push(
        `promos:${input.tenantId}:${input.branchId}:${input.productId}:${input.date.toISOString()}`
      );
      return promotions;
    },
  };

  return {
    service: new PricingService(repository as any),
    calls,
  };
};

const baseInput = () => ({
  tenantId,
  branchId,
  productId,
  quantity: 2,
  channel: "POS" as const,
});

describe("PricingService", () => {
  it("calculates a base line without tax and without promotions", async () => {
    const { service, calls } = buildService(baseProduct({ price: 100 }));

    const result = await service.calculateLineWithoutPromotions(baseInput());

    assert.deepEqual(result, {
      productId,
      quantity: 2,
      baseUnitPrice: 100,
      finalUnitPrice: 100,
      discountAmount: 0,
      discountPercent: 0,
      appliedPromotionId: null,
      appliedPromotionName: null,
      taxId: null,
      taxRate: 0,
      taxBase: 200,
      taxAmount: 0,
      taxes: [],
      lineSubtotal: 200,
      lineTotal: 200,
      explanation:
        "products.price is treated as the visible unit price with tax included; no active promotion applies.",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0], `find:${tenantId}:${productId}`);
  });

  it("calculates a base line with included tax", async () => {
    const taxId = randomUUID();
    const { service } = buildService(
      baseProduct({ price: 119, taxId, taxRate: 0.19, taxIsIncluded: true })
    );

    const result = await service.calculateLineWithoutPromotions({
      ...baseInput(),
      quantity: 2,
    });

    assert.equal(result.baseUnitPrice, 119);
    assert.equal(result.finalUnitPrice, 119);
    assert.equal(result.taxId, taxId);
    assert.equal(result.taxRate, 0.19);
    assert.equal(result.taxBase, 200);
    assert.equal(result.taxAmount, 38);
    assert.deepEqual(result.taxes, [
      {
        taxId,
        taxName: "Bridge Tax",
        dianCode: null,
        taxTypeCode: null,
        calculationMethodCode: "PERCENTAGE",
        taxRate: 0.19,
        taxBase: 200,
        taxAmount: 38,
        isIncluded: true,
      },
    ]);
    assert.equal(result.lineSubtotal, 200);
    assert.equal(result.lineTotal, 238);
  });

  it("calculates a base line with excluded tax", async () => {
    const taxId = randomUUID();
    const { service } = buildService(
      baseProduct({ price: 100, taxId, taxRate: 0.19, taxIsIncluded: false })
    );

    const result = await service.calculateLineWithoutPromotions({
      ...baseInput(),
      quantity: 2,
    });

    assert.equal(result.baseUnitPrice, 100);
    assert.equal(result.finalUnitPrice, 100);
    assert.equal(result.taxBase, 200);
    assert.equal(result.taxAmount, 38);
    assert.equal(result.taxes.length, 1);
    assert.equal(result.taxes[0]?.taxId, taxId);
    assert.equal(result.taxes[0]?.taxAmount, 38);
    assert.equal(result.lineSubtotal, 200);
    assert.equal(result.lineTotal, 238);
  });

  it("supports decimal quantity in the base calculation", async () => {
    const { service } = buildService(
      baseProduct({ price: 99.99, taxRate: 0.19, taxIsIncluded: true })
    );

    const result = await service.calculateLineWithoutPromotions({
      ...baseInput(),
      quantity: 1.5,
    });

    assert.equal(result.quantity, 1.5);
    assert.equal(result.baseUnitPrice, 99.99);
    assert.equal(result.lineTotal, 149.99);
    assert.equal(result.taxBase, 126.05);
    assert.equal(result.taxAmount, 23.94);
    assert.equal(result.taxes[0]?.taxAmount, 23.94);
  });

  it("does not query promotions for the base calculation", async () => {
    const calls: string[] = [];
    const repository = {
      findProductSnapshot: async (
        inputTenantId: string,
        inputProductId: string
      ) => {
        calls.push(`find:${inputTenantId}:${inputProductId}`);
        return baseProduct({ price: 100 });
      },
      findApplicablePromotions: async () => {
        throw new Error("promotions should not be queried");
      },
    };
    const service = new PricingService(repository as any);

    const result = await service.calculateLineWithoutPromotions(baseInput());

    assert.equal(result.lineTotal, 200);
    assert.deepEqual(calls, [`find:${tenantId}:${productId}`]);
  });

  it("applies active percentage promotion", async () => {
    const activePromotion = promotion({
      id: randomUUID(),
      name: "15 percent",
      discountType: "PERCENTAGE",
      discountValue: 15,
      priority: 10,
    });
    const { service } = buildService(baseProduct({ price: 100 }), [
      activePromotion,
    ]);

    const result = await service.calculateLinePrice(baseInput());

    assert.equal(result.finalUnitPrice, 85);
    assert.equal(result.discountAmount, 15);
    assert.equal(result.discountPercent, 15);
    assert.equal(result.appliedPromotionId, activePromotion.id);
    assert.equal(result.appliedPromotionName, "15 percent");
    assert.equal(result.lineSubtotal, 170);
    assert.equal(result.lineTotal, 170);
  });

  it("applies active fixed amount promotion and limits discount to base price", async () => {
    const activePromotion = promotion({
      name: "Big fixed",
      discountType: "FIXED_AMOUNT",
      discountValue: 150,
      priority: 10,
    });
    const { service } = buildService(baseProduct({ price: 100 }), [
      activePromotion,
    ]);

    const result = await service.calculateLinePrice(baseInput());

    assert.equal(result.finalUnitPrice, 0);
    assert.equal(result.discountAmount, 100);
    assert.equal(result.discountPercent, 100);
    assert.equal(result.lineTotal, 0);
  });

  it("applies active special price promotion when it benefits the customer", async () => {
    const activePromotion = promotion({
      name: "Special",
      discountType: "SPECIAL_PRICE",
      discountValue: 75,
      priority: 10,
    });
    const { service } = buildService(baseProduct({ price: 100 }), [
      activePromotion,
    ]);

    const result = await service.calculateLinePrice(baseInput());

    assert.equal(result.finalUnitPrice, 75);
    assert.equal(result.discountAmount, 25);
    assert.equal(result.discountPercent, 25);
    assert.equal(result.lineTotal, 150);
  });

  it("does not apply a special price that is greater than or equal to base price", async () => {
    const { service } = buildService(baseProduct({ price: 100 }), [
      promotion({
        name: "No benefit",
        discountType: "SPECIAL_PRICE",
        discountValue: 120,
        priority: 1,
      }),
    ]);

    const result = await service.calculateLinePrice(baseInput());

    assert.equal(result.finalUnitPrice, 100);
    assert.equal(result.discountAmount, 0);
    assert.equal(result.appliedPromotionId, null);
  });

  it("keeps current behavior when no applicable promotion is returned for expired inactive other product or other branch cases", async () => {
    const { service } = buildService(baseProduct({ price: 100 }), []);

    const result = await service.calculateLinePrice({
      ...baseInput(),
      date: "2026-06-01T12:00:00.000Z",
    });

    assert.equal(result.finalUnitPrice, 100);
    assert.equal(result.discountAmount, 0);
    assert.equal(result.appliedPromotionId, null);
    assert.equal(result.lineTotal, 200);
  });

  it("applies tenant-wide promotion when repository returns a promotion without branch restriction", async () => {
    const activePromotion = promotion({
      name: "Tenant wide",
      discountType: "PERCENTAGE",
      discountValue: 20,
      priority: 20,
    });
    const { service } = buildService(baseProduct({ price: 100 }), [
      activePromotion,
    ]);

    const result = await service.calculateLinePrice(baseInput());

    assert.equal(result.finalUnitPrice, 80);
    assert.equal(result.appliedPromotionId, activePromotion.id);
  });

  it("selects lower priority promotion before higher discount", async () => {
    const lowPriority = promotion({
      name: "Priority wins",
      discountType: "PERCENTAGE",
      discountValue: 5,
      priority: 1,
    });
    const highDiscount = promotion({
      name: "More discount loses",
      discountType: "PERCENTAGE",
      discountValue: 50,
      priority: 10,
    });
    const { service } = buildService(baseProduct({ price: 100 }), [
      highDiscount,
      lowPriority,
    ]);

    const result = await service.calculateLinePrice(baseInput());

    assert.equal(result.appliedPromotionId, lowPriority.id);
    assert.equal(result.discountAmount, 5);
  });

  it("selects greater discount when priority ties", async () => {
    const smallerDiscount = promotion({
      name: "Small",
      discountType: "PERCENTAGE",
      discountValue: 10,
      priority: 5,
    });
    const biggerDiscount = promotion({
      name: "Big",
      discountType: "FIXED_AMOUNT",
      discountValue: 25,
      priority: 5,
    });
    const { service } = buildService(baseProduct({ price: 100 }), [
      smallerDiscount,
      biggerDiscount,
    ]);

    const result = await service.calculateLinePrice(baseInput());

    assert.equal(result.appliedPromotionId, biggerDiscount.id);
    assert.equal(result.discountAmount, 25);
  });

  it("selects most recent promotion when priority and discount tie", async () => {
    const older = promotion({
      id: "10000000-0000-0000-0000-000000000001",
      name: "Older",
      discountValue: 10,
      priority: 5,
      createdAt: new Date("2026-06-01T09:00:00.000Z"),
    });
    const newer = promotion({
      id: "10000000-0000-0000-0000-000000000002",
      name: "Newer",
      discountValue: 10,
      priority: 5,
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
    });
    const { service } = buildService(baseProduct({ price: 100 }), [
      older,
      newer,
    ]);

    const result = await service.calculateLinePrice(baseInput());

    assert.equal(result.appliedPromotionId, newer.id);
  });

  it("calculates included tax using current sale tax rule", async () => {
    const taxId = randomUUID();
    const { service } = buildService(
      baseProduct({ price: 119, taxId, taxRate: 0.19, taxIsIncluded: true })
    );

    const result = await service.calculateLinePrice({
      ...baseInput(),
      quantity: 2,
      channel: "ORDER",
    });

    assert.equal(result.taxId, taxId);
    assert.equal(result.taxRate, 0.19);
    assert.equal(result.taxBase, 200);
    assert.equal(result.taxAmount, 38);
    assert.equal(result.taxes[0]?.taxAmount, 38);
    assert.equal(result.lineSubtotal, 200);
    assert.equal(result.lineTotal, 238);
  });

  it("recalculates included tax using promoted final unit price", async () => {
    const taxId = randomUUID();
    const { service } = buildService(
      baseProduct({ price: 119, taxId, taxRate: 0.19, taxIsIncluded: true }),
      [
        promotion({
          discountType: "SPECIAL_PRICE",
          discountValue: 59.5,
          priority: 1,
        }),
      ]
    );

    const result = await service.calculateLinePrice({
      ...baseInput(),
      quantity: 2,
    });

    assert.equal(result.finalUnitPrice, 59.5);
    assert.equal(result.lineTotal, 119);
    assert.equal(result.taxBase, 100);
    assert.equal(result.taxAmount, 19);
    assert.equal(result.taxes[0]?.taxAmount, 19);
  });

  it("supports decimal quantity and rounds to 2 decimals", async () => {
    const { service } = buildService(
      baseProduct({ price: 99.99, taxRate: 0.19, taxIsIncluded: true })
    );

    const result = await service.calculateLinePrice({
      ...baseInput(),
      quantity: 1.5,
    });

    assert.equal(result.quantity, 1.5);
    assert.equal(result.baseUnitPrice, 99.99);
    assert.equal(result.lineTotal, 149.99);
    assert.equal(result.taxBase, 126.05);
    assert.equal(result.taxAmount, 23.94);
    assert.equal(result.taxes[0]?.taxAmount, 23.94);
  });

  it("calculates a liquor stack with ICL ADV and included IVA", async () => {
    const iclTaxId = randomUUID();
    const advTaxId = randomUUID();
    const ivaTaxId = randomUUID();
    const { service } = buildService(
      baseProduct({
        price: 590000,
        taxId: ivaTaxId,
        taxRate: 0.05,
        taxIsIncluded: true,
        taxes: [
          productTax({
            taxId: iclTaxId,
            taxName: "ICL",
            calculationMethodCode: "PER_ALCOHOL_DEGREE_VOLUME",
            calculationOrder: 1,
            isIncluded: true,
            rate: 0,
            percentageRate: null,
            fixedAmount: 360,
            baseQuantity: 750,
          }),
          productTax({
            taxId: advTaxId,
            taxName: "ADV",
            taxTypeCode: "AD_VALOREM",
            calculationMethodCode: "AD_VALOREM",
            calculationOrder: 2,
            isIncluded: true,
            rate: 0.25,
            percentageRate: 0.25,
          }),
          productTax({
            taxId: ivaTaxId,
            taxName: "IVA 5%",
            calculationMethodCode: "PERCENTAGE",
            calculationOrder: 3,
            isIncluded: true,
            rate: 0.05,
            percentageRate: 0.05,
          }),
        ],
        taxProfile: taxProfile({
          alcoholDegree: 40,
          netVolumeMl: 750,
          daneCertifiedRetailPrice: 400000,
        }),
      })
    );

    const result = await service.calculateLineWithoutPromotions({
      ...baseInput(),
      quantity: 1,
    });

    assert.equal(result.taxId, ivaTaxId);
    assert.equal(result.taxRate, 0.05);
    assert.equal(result.taxBase, 452952.38);
    assert.equal(result.taxAmount, 137047.62);
    assert.equal(result.lineSubtotal, 452952.38);
    assert.equal(result.lineTotal, 590000);
    assert.deepEqual(result.taxes, [
      {
        taxId: iclTaxId,
        taxName: "ICL",
        dianCode: null,
        taxTypeCode: null,
        calculationMethodCode: "PER_ALCOHOL_DEGREE_VOLUME",
        taxRate: 0,
        taxBase: 40,
        taxAmount: 14400,
        isIncluded: true,
      },
      {
        taxId: advTaxId,
        taxName: "ADV",
        dianCode: null,
        taxTypeCode: "AD_VALOREM",
        calculationMethodCode: "AD_VALOREM",
        taxRate: 0.25,
        taxBase: 400000,
        taxAmount: 100000,
        isIncluded: true,
      },
      {
        taxId: ivaTaxId,
        taxName: "IVA 5%",
        dianCode: null,
        taxTypeCode: null,
        calculationMethodCode: "PERCENTAGE",
        taxRate: 0.05,
        taxBase: 452952.38,
        taxAmount: 22647.62,
        isIncluded: true,
      },
    ]);
  });

  it("rejects quantity 0", async () => {
    const { service } = buildService(baseProduct());

    await assert.rejects(
      () =>
        service.calculateLineWithoutPromotions({
          ...baseInput(),
          quantity: 0,
        }),
      /quantity must be greater than 0/
    );
  });

  it("rejects inactive product", async () => {
    const { service } = buildService(baseProduct({ isActive: false }));

    await assert.rejects(
      () => service.calculateLineWithoutPromotions(baseInput()),
      /product is inactive/
    );
  });

  it("rejects product from another tenant as not found", async () => {
    const { service } = buildService(null);

    await assert.rejects(
      () => service.calculateLineWithoutPromotions(baseInput()),
      /product not found/
    );
  });

  it("rejects invalid channel", async () => {
    const { service } = buildService(baseProduct());

    await assert.rejects(
      () =>
        service.calculateLineWithoutPromotions({
          ...baseInput(),
          channel: "WEB" as any,
        }),
      /channel must be POS or ORDER/
    );
  });

  it("does not persist data while calculating", async () => {
    const { service, calls } = buildService(baseProduct());

    await service.calculateLinePrice(baseInput());

    assert.equal(calls[0], `find:${tenantId}:${productId}`);
    assert.ok(calls[1].startsWith(`promos:${tenantId}:${branchId}:${productId}:`));
    assert.equal(calls.length, 2);
  });
});
