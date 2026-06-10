import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  ProductBarcodeEntity,
  type ProductBarcodeProps,
} from "../entities/product-barcode.entity";
import { ProductEntity, type ProductProps } from "../entities/product.entity";
import { ProductBarcodeService } from "./product-barcode.service";

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const productId = randomUUID();
const unitId = randomUUID();

const buildProduct = (
  overrides: Partial<ProductProps> = {}
): ProductEntity =>
  ProductEntity.create({
    id: productId,
    tenantId,
    unitId,
    taxId: null,
    name: "Producto con barcode",
    description: null,
    sku: "SKU-BARCODE",
    price: 100,
    cost: 50,
    priceWithTax: 100,
    priceWithoutTax: 100,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const buildBarcode = (
  overrides: Partial<ProductBarcodeProps> = {}
): ProductBarcodeEntity =>
  ProductBarcodeEntity.create({
    id: randomUUID(),
    tenantId,
    productId,
    barcode: "ABC-001",
    barcodeType: "UNIT",
    isPrimary: false,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const buildService = (
  initialBarcodes: ProductBarcodeEntity[] = [],
  products: ProductEntity[] = [buildProduct()]
) => {
  const barcodes = [...initialBarcodes];
  const txQueries: string[] = [];
  let unsetPrimaryCalls = 0;

  const barcodeRepository = {
    findByProduct: async (requestedTenantId: string, requestedProductId: string) =>
      barcodes.filter(
        (barcode) =>
          barcode.tenantId === requestedTenantId &&
          barcode.productId === requestedProductId
      ),
    findById: async (requestedTenantId: string, barcodeId: string) =>
      barcodes.find(
        (barcode) =>
          barcode.tenantId === requestedTenantId && barcode.id === barcodeId
      ) ?? null,
    findActiveByBarcode: async (requestedTenantId: string, code: string) =>
      barcodes.find(
        (barcode) =>
          barcode.tenantId === requestedTenantId &&
          barcode.barcode === code &&
          barcode.isActive
      ) ?? null,
    create: async (data: ProductBarcodeProps) => {
      const created = ProductBarcodeEntity.create(data);
      barcodes.push(created);
      return created;
    },
    update: async (
      requestedTenantId: string,
      barcodeId: string,
      data: Partial<ProductBarcodeProps>
    ) => {
      const index = barcodes.findIndex(
        (barcode) =>
          barcode.tenantId === requestedTenantId && barcode.id === barcodeId
      );
      if (index < 0) {
        return null;
      }
      const updated = ProductBarcodeEntity.create({
        ...barcodes[index],
        ...data,
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      barcodes[index] = updated;
      return updated;
    },
    deactivate: async (requestedTenantId: string, barcodeId: string) =>
      barcodeRepository.update(requestedTenantId, barcodeId, {
        isActive: false,
        isPrimary: false,
      }),
    unsetPrimaryForProduct: async (
      requestedTenantId: string,
      requestedProductId: string,
      exceptBarcodeId?: string
    ) => {
      unsetPrimaryCalls += 1;
      for (let index = 0; index < barcodes.length; index += 1) {
        const barcode = barcodes[index];
        if (
          barcode.tenantId === requestedTenantId &&
          barcode.productId === requestedProductId &&
          barcode.id !== exceptBarcodeId &&
          barcode.isActive
        ) {
          barcodes[index] = ProductBarcodeEntity.create({
            ...barcode,
            isPrimary: false,
          });
        }
      }
    },
    setPrimary: async (
      requestedTenantId: string,
      requestedProductId: string,
      barcodeId: string
    ) =>
      barcodeRepository.update(requestedTenantId, barcodeId, {
        productId: requestedProductId,
        isPrimary: true,
      }),
  };

  const productRepository = {
    findById: async (requestedProductId: string, requestedTenantId: string) =>
      products.find(
        (product) =>
          product.id === requestedProductId &&
          product.tenantId === requestedTenantId
      ) ?? null,
  };

  const db = {
    getClient: async () => ({
      query: async (sql: string) => {
        txQueries.push(sql);
        return { rows: [] };
      },
      release: () => undefined,
    }),
  };

  return {
    barcodes,
    txQueries,
    get unsetPrimaryCalls() {
      return unsetPrimaryCalls;
    },
    service: new ProductBarcodeService(
      barcodeRepository as any,
      productRepository as any,
      db as any
    ),
  };
};

describe("ProductBarcodeService", () => {
  it("creates a barcode with UNIT type by default", async () => {
    const context = buildService();

    const barcode = await context.service.create({
      tenantId,
      productId,
      barcode: " 123456 ",
    });

    assert.equal(barcode.barcode, "123456");
    assert.equal(barcode.barcodeType, "UNIT");
    assert.equal(barcode.isPrimary, false);
    assert.equal(barcode.isActive, true);
  });

  it("unsets other active primary barcodes when creating a primary barcode", async () => {
    const first = buildBarcode({ isPrimary: true, barcode: "FIRST" });
    const context = buildService([first]);

    const created = await context.service.create({
      tenantId,
      productId,
      barcode: "SECOND",
      isPrimary: true,
    });

    assert.equal(created.isPrimary, true);
    assert.equal(context.unsetPrimaryCalls, 1);
    assert.equal(context.barcodes.find((item) => item.id === first.id)?.isPrimary, false);
  });

  it("rejects empty barcode", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create({
          tenantId,
          productId,
          barcode: "   ",
        }),
      /barcode is required/
    );
  });

  it("rejects invalid barcode type", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create({
          tenantId,
          productId,
          barcode: "ABC",
          barcodeType: "PALLET" as any,
        }),
      /barcodeType is invalid/
    );
  });

  it("rejects duplicate active barcode in the same tenant", async () => {
    const context = buildService([buildBarcode({ barcode: "DUP" })]);

    await assert.rejects(
      () =>
        context.service.create({
          tenantId,
          productId,
          barcode: "DUP",
        }),
      /barcode already exists for this tenant/
    );
  });

  it("allows same barcode in a different tenant at service level", async () => {
    const otherTenantProduct = buildProduct({
      id: productId,
      tenantId: otherTenantId,
    });
    const context = buildService(
      [buildBarcode({ tenantId: otherTenantId, barcode: "SHARED" })],
      [buildProduct(), otherTenantProduct]
    );

    const barcode = await context.service.create({
      tenantId,
      productId,
      barcode: "SHARED",
    });

    assert.equal(barcode.tenantId, tenantId);
    assert.equal(barcode.barcode, "SHARED");
  });

  it("rejects barcode for product from another tenant", async () => {
    const otherProduct = buildProduct({
      tenantId: otherTenantId,
    });
    const context = buildService([], [otherProduct]);

    await assert.rejects(
      () =>
        context.service.create({
          tenantId,
          productId,
          barcode: "ABC",
        }),
      /product not found/
    );
  });

  it("updates barcode value and type", async () => {
    const current = buildBarcode({ barcode: "OLD" });
    const context = buildService([current]);

    const updated = await context.service.update({
      tenantId,
      productId,
      barcodeId: current.id,
      barcode: "NEW",
      barcodeType: "BOX",
    });

    assert.equal(updated.barcode, "NEW");
    assert.equal(updated.barcodeType, "BOX");
  });

  it("rejects update to duplicate active barcode", async () => {
    const current = buildBarcode({ barcode: "OLD" });
    const duplicate = buildBarcode({ barcode: "DUP" });
    const context = buildService([current, duplicate]);

    await assert.rejects(
      () =>
        context.service.update({
          tenantId,
          productId,
          barcodeId: current.id,
          barcode: "DUP",
        }),
      /barcode already exists for this tenant/
    );
  });

  it("deactivates barcode without deleting it", async () => {
    const current = buildBarcode({ isPrimary: true });
    const context = buildService([current]);

    const deactivated = await context.service.deactivate(
      tenantId,
      productId,
      current.id
    );

    assert.equal(deactivated.isActive, false);
    assert.equal(deactivated.isPrimary, false);
  });

  it("does not mark inactive barcode as primary", async () => {
    const inactive = buildBarcode({ isActive: false });
    const context = buildService([inactive]);

    await assert.rejects(
      () => context.service.setPrimary(tenantId, productId, inactive.id),
      /inactive barcode cannot be primary/
    );
  });
});
