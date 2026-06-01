import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { PromotionsService } from "./promotions.service";
import type { PromotionEntity } from "./promotions.types";

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const productId = randomUUID();
const secondProductId = randomUUID();
const branchId = randomUUID();

const baseCreateInput = () => ({
  tenantId,
  name: "Promo Huevos 10%",
  description: "Descuento local QA",
  discountType: "PERCENTAGE" as const,
  discountValue: 10,
  startsAt: "2026-06-01T00:00:00.000Z",
  endsAt: "2026-06-30T23:59:59.000Z",
  priority: 100,
  isStackable: false,
  productIds: [productId],
  branchIds: [branchId],
  createdBy: randomUUID(),
});

const buildPromotion = (
  overrides: Partial<PromotionEntity> = {}
): PromotionEntity => ({
  id: randomUUID(),
  tenantId,
  name: "Promo Huevos 10%",
  description: "Descuento local QA",
  promotionType: "PRODUCT_DISCOUNT",
  discountType: "PERCENTAGE",
  discountValue: 10,
  startsAt: new Date("2026-06-01T00:00:00.000Z"),
  endsAt: new Date("2026-06-30T23:59:59.000Z"),
  priority: 100,
  isStackable: false,
  isActive: true,
  createdBy: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  productIds: [productId],
  branchIds: [branchId],
  ...overrides,
});

const buildService = (initialPromotions: PromotionEntity[] = []) => {
  const promotions = new Map<string, PromotionEntity>();
  for (const promotion of initialPromotions) {
    promotions.set(promotion.id, promotion);
  }
  const calls: string[] = [];
  const validProducts = new Set([productId, secondProductId]);
  const validBranches = new Set([branchId]);
  const client = {
    query: async (sql: string) => {
      calls.push(sql);
      return { rows: [] };
    },
    release: () => calls.push("release"),
  };
  const db = {
    getClient: async () => client,
  };
  const repository = {
    list: async (inputTenantId: string, filters: any = {}) =>
      Array.from(promotions.values()).filter((promotion) => {
        if (promotion.tenantId !== inputTenantId) {
          return false;
        }
        if (
          filters.productId &&
          !promotion.productIds.includes(filters.productId)
        ) {
          return false;
        }
        if (
          filters.isActive !== undefined &&
          promotion.isActive !== filters.isActive
        ) {
          return false;
        }
        return true;
      }),
    findById: async (inputTenantId: string, promotionId: string) => {
      const promotion = promotions.get(promotionId) ?? null;
      return promotion?.tenantId === inputTenantId ? promotion : null;
    },
    countProductsByTenant: async (inputTenantId: string, productIds: string[]) =>
      inputTenantId === tenantId
        ? productIds.filter((id) => validProducts.has(id)).length
        : 0,
    countBranchesByTenant: async (inputTenantId: string, branchIds: string[]) =>
      inputTenantId === tenantId
        ? branchIds.filter((id) => validBranches.has(id)).length
        : 0,
    create: async (data: any, productIds: string[], branchIds: string[]) => {
      const promotion = buildPromotion({
        id: data.id,
        tenantId: data.tenantId,
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        priority: data.priority,
        isStackable: data.isStackable,
        isActive: data.isActive,
        createdBy: data.createdBy,
        productIds,
        branchIds,
      });
      promotions.set(promotion.id, promotion);
      return promotion;
    },
    update: async (inputTenantId: string, promotionId: string, data: any) => {
      const current = promotions.get(promotionId);
      if (!current || current.tenantId !== inputTenantId) {
        return null;
      }
      const next = {
        ...current,
        ...data,
        updatedAt: new Date("2026-06-02T00:00:00.000Z"),
      };
      promotions.set(promotionId, next);
      return next;
    },
    replaceProducts: async (
      inputTenantId: string,
      promotionId: string,
      productIds: string[]
    ) => {
      const current = promotions.get(promotionId);
      if (current?.tenantId === inputTenantId) {
        promotions.set(promotionId, { ...current, productIds });
      }
    },
    replaceBranches: async (
      inputTenantId: string,
      promotionId: string,
      branchIds: string[]
    ) => {
      const current = promotions.get(promotionId);
      if (current?.tenantId === inputTenantId) {
        promotions.set(promotionId, { ...current, branchIds });
      }
    },
  };

  return {
    service: new PromotionsService(repository as any, db as any),
    promotions,
    calls,
  };
};

describe("PromotionsService", () => {
  it("creates a promotion by product", async () => {
    const { service } = buildService();

    const promotion = await service.createPromotion(baseCreateInput());

    assert.equal(promotion.name, "Promo Huevos 10%");
    assert.deepEqual(promotion.productIds, [productId]);
    assert.equal(promotion.discountType, "PERCENTAGE");
    assert.equal(promotion.discountValue, 10);
  });

  it("creates a promotion scoped to a branch", async () => {
    const { service } = buildService();

    const promotion = await service.createPromotion(baseCreateInput());

    assert.deepEqual(promotion.branchIds, [branchId]);
  });

  it("creates a promotion without branch for tenant-wide application", async () => {
    const { service } = buildService();

    const promotion = await service.createPromotion({
      ...baseCreateInput(),
      branchIds: [],
    });

    assert.deepEqual(promotion.branchIds, []);
  });

  it("rejects percentage over 100", async () => {
    const { service } = buildService();

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          discountValue: 101,
        }),
      /percentage discountValue must be between 0 and 100/
    );
  });

  it("rejects invalid discount type", async () => {
    const { service } = buildService();

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          discountType: "BOGO" as any,
        }),
      /discountType is invalid/
    );
  });

  it("rejects negative discount value", async () => {
    const { service } = buildService();

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          discountValue: -1,
        }),
      /discountValue must be greater than or equal to 0/
    );
  });

  it("rejects invalid special price values", async () => {
    const { service } = buildService();

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          discountType: "SPECIAL_PRICE",
          discountValue: -10,
        }),
      /discountValue must be greater than or equal to 0/
    );

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          discountType: "SPECIAL_PRICE",
          discountValue: Number.NaN,
        }),
      /discountValue is required/
    );
  });

  it("rejects invalid startsAt and endsAt dates", async () => {
    const { service } = buildService();

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          startsAt: "bad-date",
        }),
      /startsAt is invalid/
    );

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          endsAt: "bad-date",
        }),
      /endsAt is invalid/
    );
  });

  it("rejects invalid validity range", async () => {
    const { service } = buildService();

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          endsAt: "2026-05-31T00:00:00.000Z",
        }),
      /endsAt must be greater than startsAt/
    );
  });

  it("rejects negative priority", async () => {
    const { service } = buildService();

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          priority: -1,
        }),
      /priority must be a non-negative integer/
    );
  });

  it("rejects promotion without products", async () => {
    const { service } = buildService();

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          productIds: [],
        }),
      /productIds must contain at least one product/
    );
  });

  it("rejects product from another tenant", async () => {
    const { service } = buildService();

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          productIds: [randomUUID()],
        }),
      /all products must belong to tenant/
    );
  });

  it("rejects branch from another tenant", async () => {
    const { service } = buildService();

    await assert.rejects(
      () =>
        service.createPromotion({
          ...baseCreateInput(),
          branchIds: [randomUUID()],
        }),
      /all branches must belong to tenant/
    );
  });

  it("lists and filters by productId", async () => {
    const matching = buildPromotion({ productIds: [productId] });
    const other = buildPromotion({ productIds: [secondProductId] });
    const { service } = buildService([matching, other]);

    const result = await service.listPromotions(tenantId, { productId });

    assert.deepEqual(
      result.map((promotion) => promotion.id),
      [matching.id]
    );
  });

  it("lists and filters by isActive", async () => {
    const active = buildPromotion({ isActive: true });
    const inactive = buildPromotion({ isActive: false });
    const { service } = buildService([active, inactive]);

    const result = await service.listPromotions(tenantId, { isActive: false });

    assert.deepEqual(
      result.map((promotion) => promotion.id),
      [inactive.id]
    );
  });

  it("updates a promotion", async () => {
    const current = buildPromotion();
    const { service } = buildService([current]);

    const result = await service.updatePromotion(tenantId, current.id, {
      name: "Promo Huevos 15%",
      discountValue: 15,
      productIds: [productId, secondProductId],
    });

    assert.equal(result.name, "Promo Huevos 15%");
    assert.equal(result.discountValue, 15);
    assert.deepEqual(result.productIds, [productId, secondProductId]);
  });

  it("deactivates without physical delete", async () => {
    const current = buildPromotion({ isActive: true });
    const { service, promotions } = buildService([current]);

    const result = await service.deactivatePromotion(tenantId, current.id);

    assert.equal(result.isActive, false);
    assert.equal(promotions.has(current.id), true);
  });

  it("isolates tenants", async () => {
    const current = buildPromotion({ tenantId });
    const { service } = buildService([current]);

    await assert.rejects(
      () => service.getPromotion(otherTenantId, current.id),
      /promotion not found/
    );
  });
});
