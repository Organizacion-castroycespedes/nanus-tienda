import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClearedPosProductCatalogFilters,
  filterPosProductsByClassification,
  filterPosProductsForCatalog,
  resolveEffectivePosProductImage,
  resolvePosSubcategoryFilterForCategory,
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
        { categoryId: " cat-1 ", subcategoryId: "sub-1" },
        { categoryId: "cat-2", subcategoryId: "sub-2" },
        { category_id: "cat-1", subcategory_id: null },
        { categoryId: null, subcategoryId: null },
      ],
      { categoryId: "cat-1" }
    );

    assert.deepEqual(result, [
      { categoryId: " cat-1 ", subcategoryId: "sub-1" },
      { category_id: "cat-1", subcategory_id: null },
    ]);
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

  it("combines search and category filters", () => {
    const result = filterPosProductsForCatalog(
      [
        {
          id: "prod-1",
          name: "Leche entera",
          description: null,
          sku: "L-001",
          stock: 10,
          categoryId: "cat-1",
          subcategoryId: "sub-1",
        },
        {
          id: "prod-2",
          name: "Leche de almendras",
          description: null,
          sku: "A-001",
          stock: 8,
          categoryId: "cat-2",
          subcategoryId: "sub-2",
        },
        {
          id: "prod-3",
          name: "Yogur natural",
          description: null,
          sku: "Y-001",
          stock: 6,
          categoryId: "cat-1",
          subcategoryId: "sub-3",
        },
      ],
      { query: "leche", categoryId: "cat-1", stockFilter: "all" }
    );

    assert.deepEqual(
      result.map((product) => product.id),
      ["prod-1"]
    );
  });

  it("keeps products without subcategory when filtering by category only", () => {
    const result = filterPosProductsForCatalog(
      [
        {
          id: "prod-1",
          name: "Pan tajado",
          description: null,
          sku: "P-001",
          stock: 10,
          categoryId: "cat-1",
          subcategoryId: null,
        },
        {
          id: "prod-2",
          name: "Arepa",
          description: null,
          sku: "A-001",
          stock: 10,
          categoryId: "cat-2",
          subcategoryId: null,
        },
      ],
      { categoryId: "cat-1" }
    );

    assert.deepEqual(
      result.map((product) => product.id),
      ["prod-1"]
    );
  });

  it("resets selected subcategory when changing to an unrelated category", () => {
    assert.equal(
      resolvePosSubcategoryFilterForCategory("sub-1", "cat-2", [
        { id: "sub-1", categoryId: "cat-1" },
        { id: "sub-2", categoryId: "cat-2" },
      ]),
      ""
    );

    assert.equal(
      resolvePosSubcategoryFilterForCategory("sub-2", "cat-2", [
        { id: "sub-1", categoryId: "cat-1" },
        { id: "sub-2", categoryId: "cat-2" },
      ]),
      "sub-2"
    );
  });

  it("builds cleared search and classification filters", () => {
    assert.deepEqual(buildClearedPosProductCatalogFilters(), {
      query: "",
      categoryId: "",
      subcategoryId: "",
    });
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
