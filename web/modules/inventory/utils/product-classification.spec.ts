import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getClassificationInitials,
  normalizeSortOrder,
  slugifyClassificationName,
  validateProductClassificationForm,
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
});
