import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  ProductCategoryEntity,
  type ProductCategoryProps,
} from "../entities/product-category.entity";
import { ProductCategoryService } from "./product-category.service";

const tenantId = randomUUID();
const secondTenantId = randomUUID();

const buildCategory = (
  overrides: Partial<ProductCategoryProps> = {}
): ProductCategoryEntity =>
  ProductCategoryEntity.create({
    id: randomUUID(),
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

const buildService = (
  seedCategories: ProductCategoryEntity[] = []
) => {
  const categories = [...seedCategories];
  const repository = {
    findMany: async (
      requestedTenantId: string,
      filters: { isActive?: boolean; search?: string } = {}
    ) =>
      categories.filter(
        (category) =>
          category.tenantId === requestedTenantId &&
          (filters.isActive === undefined ||
            category.isActive === filters.isActive) &&
          (!filters.search ||
            category.name.includes(filters.search) ||
            category.slug.includes(filters.search))
      ),
    findById: async (requestedTenantId: string, categoryId: string) =>
      categories.find(
        (category) =>
          category.tenantId === requestedTenantId &&
          category.id === categoryId
      ) ?? null,
    findBySlug: async (requestedTenantId: string, slug: string) =>
      categories.find(
        (category) =>
          category.tenantId === requestedTenantId && category.slug === slug
      ) ?? null,
    create: async (data: ProductCategoryProps) => {
      const category = ProductCategoryEntity.create(data);
      categories.push(category);
      return category;
    },
    update: async (
      requestedTenantId: string,
      categoryId: string,
      data: Partial<ProductCategoryProps>
    ) => {
      const index = categories.findIndex(
        (category) =>
          category.tenantId === requestedTenantId &&
          category.id === categoryId
      );
      if (index < 0) {
        return null;
      }
      const updated = ProductCategoryEntity.create({
        ...categories[index],
        ...data,
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      categories[index] = updated;
      return updated;
    },
  };

  return {
    service: new ProductCategoryService(repository as any),
    categories,
  };
};

describe("ProductCategoryService", () => {
  it("creates a category", async () => {
    const { service } = buildService();

    const category = await service.create({
      tenantId,
      name: "Lacteos",
      description: "Linea fria",
      defaultImageMimeType: "image/webp",
      defaultImageSizeBytes: 1234,
    });

    assert.equal(category.tenantId, tenantId);
    assert.equal(category.name, "Lacteos");
    assert.equal(category.slug, "lacteos");
    assert.equal(category.description, "Linea fria");
    assert.equal(category.defaultImageMimeType, "image/webp");
    assert.equal(category.defaultImageSizeBytes, 1234);
    assert.equal(category.isActive, true);
  });

  it("rejects duplicate slug inside the same tenant", async () => {
    const { service } = buildService([buildCategory()]);

    await assert.rejects(
      () =>
        service.create({
          tenantId,
          name: "Bebidas",
          slug: "bebidas",
        }),
      /slug already exists for this tenant/
    );
  });

  it("allows same slug in another tenant", async () => {
    const { service } = buildService([buildCategory()]);

    const category = await service.create({
      tenantId: secondTenantId,
      name: "Bebidas",
      slug: "bebidas",
    });

    assert.equal(category.tenantId, secondTenantId);
    assert.equal(category.slug, "bebidas");
  });

  it("lists only categories from the requested tenant", async () => {
    const first = buildCategory({ name: "Bebidas", slug: "bebidas" });
    const second = buildCategory({
      tenantId: secondTenantId,
      name: "Abarrotes",
      slug: "abarrotes",
    });
    const { service } = buildService([first, second]);

    const result = await service.list(tenantId);

    assert.deepEqual(result.map((category) => category.id), [first.id]);
  });

  it("blocks cross-tenant update", async () => {
    const category = buildCategory({ tenantId: secondTenantId });
    const { service } = buildService([category]);

    await assert.rejects(
      () =>
        service.update({
          tenantId,
          categoryId: category.id,
          name: "Nuevo nombre",
        }),
      /product category not found/
    );
  });

  it("activates and deactivates category without physical delete", async () => {
    const category = buildCategory();
    const { service } = buildService([category]);

    const deactivated = await service.deactivate(tenantId, category.id);
    const activated = await service.activate(tenantId, category.id);

    assert.equal(deactivated.isActive, false);
    assert.equal(activated.isActive, true);
  });
});
