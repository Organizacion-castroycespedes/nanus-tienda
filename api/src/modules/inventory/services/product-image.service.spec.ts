import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { ProductCategoryEntity } from "../entities/product-category.entity";
import { ProductEntity, type ProductProps } from "../entities/product.entity";
import { ProductSubcategoryEntity } from "../entities/product-subcategory.entity";
import { ProductImageService } from "./product-image.service";

const tenantId = randomUUID();
const secondTenantId = randomUUID();
const unitId = randomUUID();
const productId = randomUUID();
const categoryId = randomUUID();
const subcategoryId = randomUUID();

const buildProduct = (
  overrides: Partial<ProductProps> = {}
): ProductEntity =>
  ProductEntity.create({
    id: productId,
    tenantId,
    unitId,
    taxId: null,
    name: "Producto",
    description: null,
    sku: "SKU-IMG",
    price: 100,
    cost: 50,
    priceWithTax: 100,
    priceWithoutTax: 100,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const buildCategory = (overrides = {}) =>
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

const buildSubcategory = (overrides = {}) =>
  ProductSubcategoryEntity.create({
    id: subcategoryId,
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

const buildFile = () => ({
  originalname: "image.jpg",
  mimetype: "image/jpeg",
  size: 4,
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
});

const buildService = () => {
  const products = [buildProduct()];
  const categories = [buildCategory()];
  const subcategories = [buildSubcategory()];
  const deletedKeys: string[] = [];
  let counter = 0;

  const storage = {
    getProductMaxSizeMb: () => 5,
    getCategoryMaxSizeMb: () => 5,
    saveImage: async (input: {
      target: string;
      tenantId: string;
      ownerId: string;
    }) => {
      counter += 1;
      return {
        storageKey: `${input.target}/${input.tenantId}/${input.ownerId}/${counter}.jpg`,
        mimeType: "image/jpeg" as const,
        sizeBytes: 4,
      };
    },
    buildImageUrl: (target: string, ownerId: string) =>
      `/api/inventory/${target}/${ownerId}/image`,
    readImage: async (storageKey: string, mimeType: "image/jpeg") => ({
      buffer: Buffer.from(storageKey),
      mimeType,
    }),
    deleteImage: async (storageKey: string | null | undefined) => {
      if (storageKey) {
        deletedKeys.push(storageKey);
      }
    },
  };

  const productRepository = {
    findById: async (requestedProductId: string, requestedTenantId: string) =>
      products.find(
        (product) =>
          product.id === requestedProductId &&
          product.tenantId === requestedTenantId
      ) ?? null,
    update: async (
      requestedProductId: string,
      requestedTenantId: string,
      data: Partial<ProductProps>
    ) => {
      const index = products.findIndex(
        (product) =>
          product.id === requestedProductId &&
          product.tenantId === requestedTenantId
      );
      if (index < 0) {
        return null;
      }
      const updated = ProductEntity.create({
        ...products[index],
        ...data,
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      products[index] = updated;
      return updated;
    },
  };

  const categoryRepository = {
    findById: async (requestedTenantId: string, requestedCategoryId: string) =>
      categories.find(
        (category) =>
          category.id === requestedCategoryId &&
          category.tenantId === requestedTenantId
      ) ?? null,
    update: async (
      requestedTenantId: string,
      requestedCategoryId: string,
      data: Record<string, unknown>
    ) => {
      const index = categories.findIndex(
        (category) =>
          category.id === requestedCategoryId &&
          category.tenantId === requestedTenantId
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

  const subcategoryRepository = {
    findById: async (
      requestedTenantId: string,
      requestedSubcategoryId: string
    ) =>
      subcategories.find(
        (subcategory) =>
          subcategory.id === requestedSubcategoryId &&
          subcategory.tenantId === requestedTenantId
      ) ?? null,
    update: async (
      requestedTenantId: string,
      requestedSubcategoryId: string,
      data: Record<string, unknown>
    ) => {
      const index = subcategories.findIndex(
        (subcategory) =>
          subcategory.id === requestedSubcategoryId &&
          subcategory.tenantId === requestedTenantId
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
    service: new ProductImageService(
      storage as any,
      productRepository as any,
      categoryRepository as any,
      subcategoryRepository as any
    ),
    products,
    categories,
    subcategories,
    deletedKeys,
  };
};

describe("ProductImageService", () => {
  it("uploads, replaces and deletes a product image", async () => {
    const { service, deletedKeys } = buildService();

    const uploaded = await service.uploadProductImage(
      tenantId,
      productId,
      buildFile(),
      "Alt"
    );
    assert.equal(uploaded.imageMimeType, "image/jpeg");
    assert.equal(uploaded.imageSizeBytes, 4);
    assert.equal(uploaded.imageAltText, "Alt");

    const replaced = await service.uploadProductImage(
      tenantId,
      productId,
      buildFile()
    );
    assert.notEqual(replaced.imageStorageKey, uploaded.imageStorageKey);
    assert.deepEqual(deletedKeys, [uploaded.imageStorageKey]);

    const deleted = await service.deleteProductImage(tenantId, productId);
    assert.equal(deleted.imageStorageKey, null);
    assert.equal(deleted.imageUrl, null);
    assert.equal(deleted.imageUpdatedAt, null);
    assert.equal(deletedKeys[deletedKeys.length - 1], replaced.imageStorageKey);
  });

  it("blocks product image access across tenants", async () => {
    const { service, deletedKeys } = buildService();

    await assert.rejects(
      () => service.uploadProductImage(secondTenantId, productId, buildFile()),
      /product not found/
    );
    await assert.rejects(
      () => service.readProductImage(secondTenantId, productId),
      /product image not found/
    );
    assert.deepEqual(deletedKeys, []);
  });

  it("uploads and deletes category and subcategory images", async () => {
    const { service } = buildService();

    const category = await service.uploadCategoryImage(
      tenantId,
      categoryId,
      buildFile()
    );
    assert.equal(category.defaultImageMimeType, "image/jpeg");
    assert.equal(category.defaultImageSizeBytes, 4);

    const deletedCategory = await service.deleteCategoryImage(
      tenantId,
      categoryId
    );
    assert.equal(deletedCategory.defaultImageStorageKey, null);

    const subcategory = await service.uploadSubcategoryImage(
      tenantId,
      subcategoryId,
      buildFile()
    );
    assert.equal(subcategory.defaultImageMimeType, "image/jpeg");
    assert.equal(subcategory.defaultImageSizeBytes, 4);

    const deletedSubcategory = await service.deleteSubcategoryImage(
      tenantId,
      subcategoryId
    );
    assert.equal(deletedSubcategory.defaultImageStorageKey, null);
  });

  it("blocks category and subcategory images across tenants", async () => {
    const { service } = buildService();

    await assert.rejects(
      () => service.uploadCategoryImage(secondTenantId, categoryId, buildFile()),
      /product category not found/
    );
    await assert.rejects(
      () =>
        service.uploadSubcategoryImage(
          secondTenantId,
          subcategoryId,
          buildFile()
        ),
      /product subcategory not found/
    );
  });
});
