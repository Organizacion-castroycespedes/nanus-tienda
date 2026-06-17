import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "reflect-metadata";
import { ProductCategoryController } from "./product-category.controller";
import { ProductSubcategoryController } from "./product-subcategory.controller";

const tenantId = "00000000-0000-0000-0000-000000000001";
const categoryId = "c15d4693-56ba-4106-8a0e-34dfbc807ab4";

describe("product classification controllers", () => {
  it("accepts valid UUID categoryId when creating a subcategory", () => {
    const controller = new ProductSubcategoryController({
      create: (input: unknown) => input,
    } as any);

    const result = controller.create(
      {
        categoryId,
        name: "Leche liquida",
        slug: "leche-liquida",
        sortOrder: 0,
        isActive: true,
      },
      { context: { tenantId } } as any
    ) as { categoryId: string; tenantId: string };

    assert.equal(result.categoryId, categoryId);
    assert.equal(result.tenantId, tenantId);
  });

  it("accepts valid UUID categoryId route params", () => {
    const controller = new ProductCategoryController({
      getById: (requestedTenantId: string, requestedCategoryId: string) => ({
        requestedTenantId,
        requestedCategoryId,
      }),
    } as any);

    const result = controller.getById(categoryId, {
      context: { tenantId },
    } as any) as {
      requestedTenantId: string;
      requestedCategoryId: string;
    };

    assert.equal(result.requestedTenantId, tenantId);
    assert.equal(result.requestedCategoryId, categoryId);
  });
});
