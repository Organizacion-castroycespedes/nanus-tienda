import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProductClassificationPayload,
  filterProductSubcategoriesByCategory,
  getClassificationInitials,
  normalizeSortOrder,
  resolveSubcategoryForCategory,
  slugifyClassificationName,
  validateProductClassificationForm,
  validateProductClassificationSelection,
} from "./product-classification";

describe("product classification UI helpers", () => {
  it("creates URL-safe slugs from names", () => {
    assert.equal(
      slugifyClassificationName("  Lacteos y Bebidas  "),
      "lacteos-y-bebidas"
    );
    assert.equal(slugifyClassificationName("Categoria #1"), "categoria-1");
  });

  it("validates required category for subcategories", () => {
    const errors = validateProductClassificationForm(
      {
        categoryId: "",
        name: "Gaseosas",
        slug: "gaseosas",
        description: "",
        sortOrder: "0",
        isActive: true,
      },
      { requiresCategory: true }
    );

    assert.equal(errors.categoryId, "La categoria es requerida.");
  });

  it("rejects invalid sort order", () => {
    assert.equal(normalizeSortOrder("-1"), null);
    assert.equal(normalizeSortOrder("1.2"), null);
    assert.equal(normalizeSortOrder("3"), 3);
  });

  it("builds fallback initials", () => {
    assert.equal(getClassificationInitials("Bebidas Frias"), "BF");
    assert.equal(getClassificationInitials(""), "CL");
  });

  it("filters subcategories by category", () => {
    const result = filterProductSubcategoriesByCategory(
      [
        { id: "sub-1", categoryId: "cat-1" },
        { id: "sub-2", categoryId: "cat-2" },
      ],
      "cat-1"
    );

    assert.deepEqual(result.map((subcategory) => subcategory.id), ["sub-1"]);
  });

  it("clears subcategory when category changes", () => {
    const subcategories = [{ id: "sub-1", categoryId: "cat-1" }];

    assert.equal(
      resolveSubcategoryForCategory("sub-1", "cat-2", subcategories),
      ""
    );
    assert.equal(
      resolveSubcategoryForCategory("sub-1", "cat-1", subcategories),
      "sub-1"
    );
  });

  it("blocks subcategory without category", () => {
    assert.equal(
      validateProductClassificationSelection(
        { categoryId: "", subcategoryId: "sub-1" },
        []
      ),
      "Selecciona una categoria antes de elegir subcategoria."
    );
  });

  it("builds product classification payload", () => {
    assert.deepEqual(
      buildProductClassificationPayload({
        categoryId: "",
        subcategoryId: "sub-1",
      }),
      { categoryId: null, subcategoryId: null }
    );
    assert.deepEqual(
      buildProductClassificationPayload({
        categoryId: "cat-1",
        subcategoryId: "",
      }),
      { categoryId: "cat-1", subcategoryId: null }
    );
    assert.deepEqual(
      buildProductClassificationPayload({
        categoryId: "cat-1",
        subcategoryId: "sub-1",
      }),
      { categoryId: "cat-1", subcategoryId: "sub-1" }
    );
  });
});
