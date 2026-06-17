import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterPosProductsByClassification,
  resolveEffectivePosProductImage,
  sortPosClassificationOptions,
} from "./product-classification";
import type {
  ProductCategoryResponse,
  ProductSubcategoryResponse,
} from "../../inventory/services/product-classification.service";

const buildCategory = (
  overrides: Partial<ProductCategoryResponse> = {}
): ProductCategoryResponse => ({
  id: "cat-1",
  tenantId: "tenant-1",
  name: "Lacteos",
  slug: "lacteos",
  description: null,
  defaultImageUrl: null,
  defaultImageStorageKey: null,
  defaultImageAltText: null,
  defaultImageMimeType: null,
  defaultImageSizeBytes: null,
  isActive: true,
  sortOrder: 0,
  createdAt: "2026-06-17T00:00:00.000Z",
  updatedAt: "2026-06-17T00:00:00.000Z",
  ...overrides,
});

const buildSubcategory = (
  overrides: Partial<ProductSubcategoryResponse> = {}
): ProductSubcategoryResponse => ({
  ...buildCategory({
    id: "sub-1",
    name: "Leche",
    slug: "leche",
  }),
  categoryId: "cat-1",
  ...overrides,
});

describe("POS product classification helpers", () => {
  it("filters products by selected category", () => {
    const result = filterPosProductsByClassification(
      [
        { categoryId: "cat-1", subcategoryId: "sub-1" },
        { categoryId: "cat-2", subcategoryId: "sub-2" },
        { categoryId: null, subcategoryId: null },
      ],
      { categoryId: "cat-1" }
    );

    assert.deepEqual(result, [{ categoryId: "cat-1", subcategoryId: "sub-1" }]);
  });

  it("filters products by selected subcategory", () => {
    const result = filterPosProductsByClassification(
      [
        { categoryId: "cat-1", subcategoryId: "sub-1" },
        { categoryId: "cat-1", subcategoryId: "sub-2" },
        { categoryId: "cat-2", subcategoryId: "sub-1" },
      ],
      { categoryId: "cat-1", subcategoryId: "sub-1" }
    );

    assert.deepEqual(result, [{ categoryId: "cat-1", subcategoryId: "sub-1" }]);
  });

  it("keeps all products when no classification filter is selected", () => {
    const products = [
      { categoryId: "cat-1", subcategoryId: "sub-1" },
      { categoryId: null, subcategoryId: null },
    ];

    assert.deepEqual(filterPosProductsByClassification(products, {}), products);
  });

  it("uses product image before subcategory and category defaults", () => {
    const category = buildCategory({
      defaultImageUrl: "/inventory/product-categories/cat-1/image",
      defaultImageAltText: "Categoria",
    });
    const subcategory = buildSubcategory({
      defaultImageUrl: "/inventory/product-subcategories/sub-1/image",
      defaultImageAltText: "Subcategoria",
    });

    const result = resolveEffectivePosProductImage(
      {
        name: "Leche litro",
        imageUrl: "/inventory/products/product-1/image",
        imageAltText: "Producto",
        categoryId: "cat-1",
        subcategoryId: "sub-1",
      },
      {
        categoryById: new Map([[category.id, category]]),
        subcategoryById: new Map([[subcategory.id, subcategory]]),
      }
    );

    assert.deepEqual(result, {
      imageUrl: "/inventory/products/product-1/image",
      altText: "Producto",
      source: "product",
    });
  });

  it("uses subcategory image before category default", () => {
    const category = buildCategory({
      defaultImageUrl: "/inventory/product-categories/cat-1/image",
    });
    const subcategory = buildSubcategory({
      defaultImageUrl: "/inventory/product-subcategories/sub-1/image",
    });

    const result = resolveEffectivePosProductImage(
      {
        name: "Leche litro",
        imageUrl: null,
        imageAltText: null,
        categoryId: "cat-1",
        subcategoryId: "sub-1",
      },
      {
        categoryById: new Map([[category.id, category]]),
        subcategoryById: new Map([[subcategory.id, subcategory]]),
      }
    );

    assert.equal(result.imageUrl, "/inventory/product-subcategories/sub-1/image");
    assert.equal(result.source, "subcategory");
  });

  it("falls back to category image, then no image", () => {
    const category = buildCategory({
      defaultImageUrl: "/inventory/product-categories/cat-1/image",
    });
    const lookup = {
      categoryById: new Map([[category.id, category]]),
      subcategoryById: new Map<string, ProductSubcategoryResponse>(),
    };

    assert.deepEqual(
      resolveEffectivePosProductImage(
        {
          name: "Yogur",
          imageUrl: null,
          imageAltText: null,
          categoryId: "cat-1",
          subcategoryId: null,
        },
        lookup
      ),
      {
        imageUrl: "/inventory/product-categories/cat-1/image",
        altText: "Yogur",
        source: "category",
      }
    );

    assert.deepEqual(
      resolveEffectivePosProductImage(
        {
          name: "Pan",
          imageUrl: null,
          imageAltText: null,
          categoryId: null,
          subcategoryId: null,
        },
        lookup
      ),
      {
        imageUrl: null,
        altText: "Pan",
        source: null,
      }
    );
  });

  it("sorts classification options by sort_order and name", () => {
    assert.deepEqual(
      sortPosClassificationOptions([
        buildCategory({ id: "cat-2", name: "Yogures", sortOrder: 2 }),
        buildCategory({ id: "cat-3", name: "Abarrotes", sortOrder: 1 }),
        buildCategory({ id: "cat-1", name: "Lacteos", sortOrder: 1 }),
      ]).map((option) => option.id),
      ["cat-3", "cat-1", "cat-2"]
    );
  });
});
