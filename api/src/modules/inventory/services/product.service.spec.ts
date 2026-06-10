import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { ProductBarcodeEntity } from "../entities/product-barcode.entity";
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

const buildBarcode = (
  overrides: Partial<ConstructorParameters<typeof ProductBarcodeEntity>[0]> = {}
) =>
  ProductBarcodeEntity.create({
    id: randomUUID(),
    tenantId,
    productId,
    barcode: "46564567",
    barcodeType: "UNIT",
    isPrimary: false,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

type BuildServiceOptions = {
  products?: ProductEntity[];
  barcodes?: ProductBarcodeEntity[];
  stockByProduct?: Record<string, number>;
  barcodeProductIdCalls?: string[][];
};

const buildService = (
  currentProduct = buildProduct(),
  options: BuildServiceOptions = {}
) => {
  const products = options.products ?? [currentProduct];
  const repository = {
    findBySku: async () => null,
    create: async (product: ProductProps) => ProductEntity.create(product),
    findAllByTenant: async () => products,
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
    getStockByProduct: async (requestedProductId: string) => ({
      stock: options.stockByProduct?.[requestedProductId] ?? 0,
    }),
  };

  const productBarcodeRepository = {
    findActiveByProductIds: async (
      _tenantId: string,
      requestedProductIds: string[]
    ) => {
      options.barcodeProductIdCalls?.push(requestedProductIds);
      return options.barcodes ?? [];
    },
  };

  const db = {
    getClient: async () => ({
      query: async () => ({ rows: [] }),
      release: () => undefined,
    }),
  };

  return new ProductService(
    repository as any,
    stockMovementService as any,
    productBarcodeRepository as any,
    db as any
  );
};

const buildPriceChangeService = (
  currentProduct = buildProduct(),
  options: { findByIdForUpdateReturns?: ProductEntity | null } = {}
) => {
  const calls: string[] = [];
  const historyRows: any[] = [];
  const updatedProducts: Partial<ProductProps>[] = [];
  const repository = {
    findById: async (id: string, productTenantId: string) =>
      id === currentProduct.id && productTenantId === currentProduct.tenantId
        ? currentProduct
        : null,
    findByIdForUpdate: async () =>
      options.findByIdForUpdateReturns === undefined
        ? currentProduct
        : options.findByIdForUpdateReturns,
    closeCurrentPriceHistory: async () => {
      calls.push("closeCurrentPriceHistory");
    },
    createPriceHistory: async (data: any) => {
      calls.push("createPriceHistory");
      const row = {
        id: randomUUID(),
        ...data,
        status: "APPLIED",
        validTo: null,
        approvedBy: null,
        approvedAt: null,
        createdAt: data.validFrom,
      };
      historyRows.push(row);
      return row;
    },
    update: async (
      id: string,
      productTenantId: string,
      data: Partial<ProductProps>
    ) => {
      calls.push("updateProduct");
      updatedProducts.push(data);
      return ProductEntity.create({
        ...currentProduct,
        ...data,
        id,
        tenantId: productTenantId,
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
    },
    findPriceHistoryByProduct: async () => historyRows,
  };
  const stockMovementService = {
    getStockByProduct: async () => ({ stock: 0 }),
  };
  const productBarcodeRepository = {
    findActiveByProductIds: async () => [],
  };
  const client = {
    query: async (sql: string) => {
      calls.push(sql);
      return { rows: [] };
    },
    release: () => calls.push("release"),
  };
  const db = {
    getClient: async () => client,
  };

  return {
    service: new ProductService(
      repository as any,
      stockMovementService as any,
      productBarcodeRepository as any,
      db as any
    ),
    calls,
    historyRows,
    updatedProducts,
  };
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
    assert.equal(product.saleType, "UNIT");
    assert.equal(product.measurementUnit, "UND");
    assert.equal(product.minStock, null);
    assert.equal(product.maxStock, null);
  });

  it("creates weighted products with explicit sale model", async () => {
    const service = buildService();

    const product = await service.createProduct({
      ...baseCreateInput(),
      saleType: "WEIGHT",
      measurementUnit: "KG",
    });

    assert.equal(product.saleType, "WEIGHT");
    assert.equal(product.measurementUnit, "KG");
  });

  it("creates mixed unit and weight products with explicit sale model", async () => {
    const service = buildService();

    const product = await service.createProduct({
      ...baseCreateInput(),
      saleType: "BOTH",
      measurementUnit: "KG",
    });

    assert.equal(product.saleType, "BOTH");
    assert.equal(product.measurementUnit, "KG");
  });

  it("returns product by id with formal sale model fields", async () => {
    const current = buildProduct({ saleType: "WEIGHT", measurementUnit: "KG" });
    const service = buildService(current);

    const product = await service.getProductById(current.id, tenantId);

    assert.equal(product.saleType, "WEIGHT");
    assert.equal(product.measurementUnit, "KG");
  });

  it("lists products with formal sale model fields for POS catalog", async () => {
    const current = buildProduct({ saleType: "BOTH", measurementUnit: "KG" });
    const service = buildService(current);

    const [listedProduct] = (await service.listProducts(
      tenantId,
      randomUUID()
    )) as any[];

    assert.equal(listedProduct.saleType, "BOTH");
    assert.equal(listedProduct.measurementUnit, "KG");
  });

  it("lists products with active barcode data for POS scanner matching", async () => {
    const product = buildProduct();
    const service = buildService(product, {
      stockByProduct: { [product.id]: 8 },
      barcodes: [
        buildBarcode({
          productId: product.id,
          barcode: "46564567",
          isPrimary: true,
        }),
        buildBarcode({
          productId: product.id,
          barcode: "ALT-001",
          barcodeType: "INTERNAL",
        }),
        buildBarcode({
          productId: product.id,
          barcode: "INACTIVE-001",
          isActive: false,
        }),
      ],
    });

    const [listedProduct] = (await service.listProducts(
      tenantId,
      randomUUID()
    )) as any[];

    assert.equal(listedProduct.stock, 8);
    assert.equal(listedProduct.primaryBarcode, "46564567");
    assert.deepEqual(listedProduct.barcodeCodes, ["46564567", "ALT-001"]);
    assert.deepEqual(
      listedProduct.barcodes.map((barcode: { code: string }) => barcode.code),
      ["46564567", "ALT-001"]
    );
    assert.equal(listedProduct.barcodes[0].isPrimary, true);
  });

  it("lists products without barcodes using empty barcode arrays", async () => {
    const service = buildService(buildProduct(), { barcodes: [] });

    const [listedProduct] = (await service.listProducts(
      tenantId,
      randomUUID()
    )) as any[];

    assert.equal(listedProduct.primaryBarcode, null);
    assert.deepEqual(listedProduct.barcodeCodes, []);
    assert.deepEqual(listedProduct.barcodes, []);
  });

  it("loads barcodes for all listed products with one repository call", async () => {
    const firstProduct = buildProduct({ id: randomUUID(), sku: "SKU-ONE" });
    const secondProduct = buildProduct({ id: randomUUID(), sku: "SKU-TWO" });
    const barcodeProductIdCalls: string[][] = [];
    const service = buildService(firstProduct, {
      products: [firstProduct, secondProduct],
      barcodes: [
        buildBarcode({
          productId: firstProduct.id,
          barcode: "46564567",
          isPrimary: true,
        }),
        buildBarcode({
          productId: secondProduct.id,
          barcode: "SECOND-001",
          isPrimary: true,
        }),
      ],
      barcodeProductIdCalls,
    });

    const result = (await service.listProducts(tenantId, randomUUID())) as any[];

    assert.equal(barcodeProductIdCalls.length, 1);
    assert.deepEqual(barcodeProductIdCalls[0], [
      firstProduct.id,
      secondProduct.id,
    ]);
    assert.equal(result[0].primaryBarcode, "46564567");
    assert.equal(result[1].primaryBarcode, "SECOND-001");
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

  it("rejects invalid sale type", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.createProduct({
          ...baseCreateInput(),
          saleType: "PACK" as any,
        }),
      /saleType is invalid/
    );
  });

  it("rejects invalid measurement unit", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.createProduct({
          ...baseCreateInput(),
          measurementUnit: "TON" as any,
        }),
      /measurementUnit is invalid/
    );
  });

  it("rejects unit products with weight measurement unit", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.createProduct({
          ...baseCreateInput(),
          saleType: "UNIT",
          measurementUnit: "KG",
        }),
      /UNIT products must use UND/
    );
  });

  it("rejects weighted products without weight measurement unit", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.createProduct({
          ...baseCreateInput(),
          saleType: "WEIGHT",
          measurementUnit: "UND",
        }),
      /WEIGHT or BOTH products must use KG, LB, G or OZ/
    );
  });

  it("rejects direct product price update through updateProduct", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.updateProduct(productId, tenantId, {
          price: 120,
        }),
      /change-price/
    );
  });

  it("rejects direct tax price updates through updateProduct", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.updateProduct(productId, tenantId, {
          priceWithTax: 140,
        }),
      /change-price/
    );

    await assert.rejects(
      () =>
        service.updateProduct(productId, tenantId, {
          priceWithoutTax: 120,
        }),
      /change-price/
    );
  });

  it("rejects direct snake_case tax price updates through updateProduct", async () => {
    const service = buildService();

    await assert.rejects(
      () =>
        service.updateProduct(productId, tenantId, {
          price_with_tax: 140,
        } as any),
      /change-price/
    );

    await assert.rejects(
      () =>
        service.updateProduct(productId, tenantId, {
          price_without_tax: 120,
        } as any),
      /change-price/
    );
  });

  it("updates product fields when no price fields are present", async () => {
    const service = buildService();

    const updated = await service.updateProduct(productId, tenantId, {
      name: "Producto sin cambio de precio",
      cost: 60,
    });

    assert.equal(updated.name, "Producto sin cambio de precio");
    assert.equal(updated.price, 100);
    assert.equal(updated.cost, 60);
  });

  it("updates formal sale model fields without touching price", async () => {
    const service = buildService();

    const updated = await service.updateProduct(productId, tenantId, {
      saleType: "WEIGHT",
      measurementUnit: "KG",
    });

    assert.equal(updated.saleType, "WEIGHT");
    assert.equal(updated.measurementUnit, "KG");
    assert.equal(updated.price, 100);
  });

  it("changes product price and stores applied history", async () => {
    const current = buildProduct({ price: 10000 });
    const { service, calls, historyRows, updatedProducts } =
      buildPriceChangeService(current);

    const result = await service.changePrice(current.id, tenantId, randomUUID(), {
      newPrice: 12000,
      reason: "Ajuste por nuevo costo de proveedor",
    });

    assert.equal(result.productId, current.id);
    assert.equal(result.previousPrice, 10000);
    assert.equal(result.newPrice, 12000);
    assert.equal(result.reason, "Ajuste por nuevo costo de proveedor");
    assert.equal(historyRows.length, 1);
    assert.equal(historyRows[0].status, "APPLIED");
    assert.equal(updatedProducts[0].price, 12000);
    assert.ok(calls.includes("BEGIN"));
    assert.ok(calls.includes("COMMIT"));
    assert.ok(!calls.includes("ROLLBACK"));
  });

  it("rejects empty or short price change reason", async () => {
    const { service } = buildPriceChangeService();

    await assert.rejects(
      () =>
        service.changePrice(productId, tenantId, randomUUID(), {
          newPrice: 120,
          reason: "abcd",
        }),
      /reason must be at least 5 characters long/
    );
  });

  it("rejects missing price change reason", async () => {
    const { service } = buildPriceChangeService();

    await assert.rejects(
      () =>
        service.changePrice(productId, tenantId, randomUUID(), {
          newPrice: 120,
          reason: "   ",
        }),
      /reason must be at least 5 characters long/
    );
  });

  it("rejects negative price change", async () => {
    const { service } = buildPriceChangeService();

    await assert.rejects(
      () =>
        service.changePrice(productId, tenantId, randomUUID(), {
          newPrice: -1,
          reason: "Ajuste valido",
        }),
      /newPrice must be a non-negative number/
    );
  });

  it("rejects product from another tenant", async () => {
    const { service, calls } = buildPriceChangeService(buildProduct(), {
      findByIdForUpdateReturns: null,
    });

    await assert.rejects(
      () =>
        service.changePrice(productId, randomUUID(), randomUUID(), {
          newPrice: 120,
          reason: "Ajuste valido",
        }),
      /product not found/
    );
    assert.ok(calls.includes("ROLLBACK"));
  });

  it("returns product price history after validating tenant ownership", async () => {
    const current = buildProduct();
    const { service, historyRows } = buildPriceChangeService(current);
    historyRows.push({
      id: randomUUID(),
      tenantId,
      productId: current.id,
      previousPrice: 100,
      newPrice: 120,
      reason: "Ajuste valido",
      changedBy: randomUUID(),
      validFrom: new Date("2026-01-02T00:00:00.000Z"),
      validTo: null,
      status: "APPLIED",
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const result = await service.getPriceHistory(current.id, tenantId);

    assert.equal(result.length, 1);
    assert.equal(result[0].newPrice, 120);
  });

  it("keeps historical sales untouched because price change only updates product and history", async () => {
    const { service, calls } = buildPriceChangeService();

    await service.changePrice(productId, tenantId, randomUUID(), {
      newPrice: 130,
      reason: "Ajuste valido",
    });

    assert.deepEqual(
      calls.filter((call) => call.includes("sale_items") || call.includes("order_items")),
      []
    );
  });
});
