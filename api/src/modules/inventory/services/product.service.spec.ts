import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { ProductEntity, type ProductProps } from "../entities/product.entity";
import { ProductService } from "./product.service";

const tenantId = randomUUID();
const unitId = randomUUID();
const productId = randomUUID();

const baseCreateInput = () => ({
  tenantId,
  unitId,
  name: "Producto prueba",
  sku: `SKU-${randomUUID()}`,
  price: 100,
  cost: 50,
});

const buildProduct = (
  overrides: Partial<ProductProps> = {}
): ProductEntity =>
  ProductEntity.create({
    id: productId,
    tenantId,
    unitId,
    taxId: null,
    name: "Producto actual",
    description: null,
    sku: "SKU-ACTUAL",
    price: 100,
    cost: 50,
    priceWithTax: 100,
    priceWithoutTax: 100,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const buildService = (currentProduct = buildProduct()) => {
  const repository = {
    findBySku: async () => null,
    create: async (product: ProductProps) => ProductEntity.create(product),
    findById: async () => currentProduct,
    update: async (
      id: string,
      productTenantId: string,
      data: Partial<ProductProps>
    ) =>
      ProductEntity.create({
        ...currentProduct,
        ...data,
        id,
        tenantId: productTenantId,
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
  };

  const stockMovementService = {
    getStockByProduct: async () => ({ stock: 0 }),
  };

  return new ProductService(repository as any, stockMovementService as any);
};

describe("ProductService enriched product rules", () => {
  it("creates a product without enriched fields using compatible defaults", async () => {
    const service = buildService();

    const product = await service.createProduct(baseCreateInput());

    assert.equal(product.isPerishable, false);
    assert.equal(product.requiresLot, false);
    assert.equal(product.requiresExpiration, false);
    assert.equal(product.operationalStatus, "ACTIVE");
    assert.equal(product.rotationClass, null);
    assert.equal(product.minStock, null);
    assert.equal(product.maxStock, null);
  });

  it("rejects perishable products without lot or expiration control", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.createProduct({
          ...baseCreateInput(),
          isPerishable: true,
          requiresLot: false,
          requiresExpiration: false,
        }),
      /isPerishable requires requiresLot or requiresExpiration/
    );
  });

  it("rejects expiration control without lot control", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.createProduct({
          ...baseCreateInput(),
          requiresExpiration: true,
          requiresLot: false,
        }),
      /requiresLot is required when requiresExpiration is true/
    );
  });

  it("rejects negative minimum stock", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.createProduct({
          ...baseCreateInput(),
          minStock: -1,
        }),
      /minStock must be a non-negative number/
    );
  });

  it("rejects maximum stock lower than minimum stock", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.createProduct({
          ...baseCreateInput(),
          minStock: 10,
          maxStock: 5,
        }),
      /maxStock must be greater than or equal to minStock/
    );
  });

  it("rejects invalid operational status on update", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.updateProduct(productId, tenantId, {
          operationalStatus: "ARCHIVED" as any,
        }),
      /operationalStatus is invalid/
    );
  });

  it("rejects invalid rotation class on update", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.updateProduct(productId, tenantId, {
          rotationClass: "STATIC" as any,
        }),
      /rotationClass is invalid/
    );
  });
});
