import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  ProductCategoryEntity,
  type ProductCategoryProps,
} from "../entities/product-category.entity";
import {
  ProductSubcategoryEntity,
  type ProductSubcategoryProps,
} from "../entities/product-subcategory.entity";
import { ProductSubcategoryService } from "./product-subcategory.service";

const tenantId = randomUUID();
const secondTenantId = randomUUID();
const categoryId = randomUUID();
const otherCategoryId = randomUUID();

const buildCategory = (
  overrides: Partial<ProductCategoryProps> = {}
): ProductCategoryEntity =>
  ProductCategoryEntity.create({
    id: categoryId,
    tenantId,
    name: "Bebidas",
    slug: "bebidas",
    description: null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const buildSubcategory = (
  overrides: Partial<ProductSubcategoryProps> = {}
): ProductSubcategoryEntity =>
  ProductSubcategoryEntity.create({
    id: randomUUID(),
    tenantId,
    categoryId,
    name: "Gaseosas",
    slug: "gaseosas",
    description: null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const buildService = (
  seedCategories: ProductCategoryEntity[] = [buildCategory()],
  seedSubcategories: ProductSubcategoryEntity[] = []
) => {
  const categories = [...seedCategories];
  const subcategories = [...seedSubcategories];

  const categoryRepository = {
    findById: async (requestedTenantId: string, requestedCategoryId: string) =>
      categories.find(
        (category) =>
          category.tenantId === requestedTenantId &&
          category.id === requestedCategoryId
      ) ?? null,
  };

  const subcategoryRepository = {
    findMany: async (
      requestedTenantId: string,
      filters: { categoryId?: string; isActive?: boolean; search?: string } = {}
    ) =>
      subcategories.filter(
        (subcategory) =>
          subcategory.tenantId === requestedTenantId &&
          (!filters.categoryId ||
            subcategory.categoryId === filters.categoryId) &&
          (filters.isActive === undefined ||
            subcategory.isActive === filters.isActive) &&
          (!filters.search ||
            subcategory.name.includes(filters.search) ||
            subcategory.slug.includes(filters.search))
      ),
    findById: async (requestedTenantId: string, subcategoryId: string) =>
      subcategories.find(
        (subcategory) =>
          subcategory.tenantId === requestedTenantId &&
          subcategory.id === subcategoryId
      ) ?? null,
    findBySlug: async (
      requestedTenantId: string,
      requestedCategoryId: string,
      slug: string
    ) =>
      subcategories.find(
        (subcategory) =>
          subcategory.tenantId === requestedTenantId &&
          subcategory.categoryId === requestedCategoryId &&
          subcategory.slug === slug
      ) ?? null,
    create: async (data: ProductSubcategoryProps) => {
      const subcategory = ProductSubcategoryEntity.create(data);
      subcategories.push(subcategory);
      return subcategory;
    },
    update: async (
      requestedTenantId: string,
      subcategoryId: string,
      data: Partial<ProductSubcategoryProps>
    ) => {
      const index = subcategories.findIndex(
        (subcategory) =>
          subcategory.tenantId === requestedTenantId &&
          subcategory.id === subcategoryId
      );
      if (index < 0) {
        return null;
      }
      const updated = ProductSubcategoryEntity.create({
        ...subcategories[index],
        ...data,
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      subcategories[index] = updated;
      return updated;
    },
  };

  return {
    service: new ProductSubcategoryService(
      subcategoryRepository as any,
      categoryRepository as any
    ),
    subcategories,
  };
};

describe("ProductSubcategoryService", () => {
  it("creates a subcategory", async () => {
    const { service } = buildService();

    const subcategory = await service.create({
      tenantId,
      categoryId,
      name: "Gaseosas",
      defaultImageMimeType: "image/jpeg",
      defaultImageSizeBytes: 100,
    });

    assert.equal(subcategory.tenantId, tenantId);
    assert.equal(subcategory.categoryId, categoryId);
    assert.equal(subcategory.name, "Gaseosas");
    assert.equal(subcategory.slug, "gaseosas");
    assert.equal(subcategory.defaultImageMimeType, "image/jpeg");
    assert.equal(subcategory.defaultImageSizeBytes, 100);
  });

  it("rejects duplicate slug inside the same tenant and category", async () => {
    const { service } = buildService([buildCategory()], [buildSubcategory()]);

    await assert.rejects(
      () =>
        service.create({
          tenantId,
          categoryId,
          name: "Gaseosas",
          slug: "gaseosas",
        }),
      /slug already exists for this category/
    );
  });

  it("allows same slug in another category or tenant", async () => {
    const otherCategory = buildCategory({
      id: otherCategoryId,
      name: "Lacteos",
      slug: "lacteos",
    });
    const { service } = buildService(
      [
        buildCategory(),
        otherCategory,
        buildCategory({ tenantId: secondTenantId }),
      ],
      [buildSubcategory()]
    );

    const sameTenantOtherCategory = await service.create({
      tenantId,
      categoryId: otherCategoryId,
      name: "Gaseosas",
      slug: "gaseosas",
    });
    const sameSlugOtherTenant = await service.create({
      tenantId: secondTenantId,
      categoryId,
      name: "Gaseosas",
      slug: "gaseosas",
    });

    assert.equal(sameTenantOtherCategory.categoryId, otherCategoryId);
    assert.equal(sameSlugOtherTenant.tenantId, secondTenantId);
  });

  it("lists only subcategories from the requested tenant", async () => {
    const first = buildSubcategory();
    const second = buildSubcategory({
      tenantId: secondTenantId,
      categoryId,
      slug: "externa",
    });
    const { service } = buildService(
      [
        buildCategory(),
        buildCategory({ tenantId: secondTenantId }),
      ],
      [first, second]
    );

    const result = await service.list(tenantId);

    assert.deepEqual(result.map((subcategory) => subcategory.id), [first.id]);
  });

  it("lists by category", async () => {
    const first = buildSubcategory();
    const second = buildSubcategory({
      categoryId: otherCategoryId,
      slug: "yogures",
    });
    const { service } = buildService(
      [
        buildCategory(),
        buildCategory({
          id: otherCategoryId,
          name: "Lacteos",
          slug: "lacteos",
        }),
      ],
      [first, second]
    );

    const result = await service.list(tenantId, { categoryId });

    assert.deepEqual(result.map((subcategory) => subcategory.id), [first.id]);
  });

  it("blocks category from another tenant", async () => {
    const { service } = buildService([
      buildCategory({ tenantId: secondTenantId }),
    ]);

    await assert.rejects(
      () =>
        service.create({
          tenantId,
          categoryId,
          name: "Gaseosas",
        }),
      /categoryId is invalid/
    );
  });

  it("blocks cross-tenant update", async () => {
    const subcategory = buildSubcategory({ tenantId: secondTenantId });
    const { service } = buildService(
      [buildCategory({ tenantId: secondTenantId })],
      [subcategory]
    );

    await assert.rejects(
      () =>
        service.update({
          tenantId,
          subcategoryId: subcategory.id,
          name: "Nuevo nombre",
        }),
      /product subcategory not found/
    );
  });

  it("activates and deactivates subcategory without physical delete", async () => {
    const subcategory = buildSubcategory();
    const { service } = buildService([buildCategory()], [subcategory]);

    const deactivated = await service.deactivate(tenantId, subcategory.id);
    const activated = await service.activate(tenantId, subcategory.id);

    assert.equal(deactivated.isActive, false);
    assert.equal(activated.isActive, true);
  });
});
