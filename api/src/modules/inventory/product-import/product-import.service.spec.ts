import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PRODUCT_IMPORT_COLUMNS } from "./product-import.columns";
import { parseProductImportWorkbook } from "./product-import.parser";
import { ProductImportService } from "./product-import.service";

const HEADERS = [
  "sku",
  "nombre",
  "unidad",
  "precio_venta",
  "costo",
  "iva",
  "categoria",
  "cantidad",
];

async function buildFile(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Productos");
  sheet.addRow(HEADERS);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

function buildService(
  options: {
    existingProducts?: Array<Record<string, unknown>>;
    failCreateSku?: string;
  } = {}
) {
  const calls: Array<[string, unknown]> = [];
  let createdCount = 0;

  const service = new ProductImportService(
    {
      listBranches: async () => [
        { id: "branch-1", code: "PRINCIPAL", name: "Principal", isActive: true },
      ],
      listProductsBySkus: async () => options.existingProducts ?? [],
      listActiveBarcodes: async () => [],
    } as never,
    {
      findAllByTenant: async () => [
        { id: "unit-1", name: "Unidad", abbreviation: "UND", isActive: true },
      ],
    } as never,
    {
      findAllByTenant: async () => [
        {
          id: "tax-iva19",
          name: "IVA 19%",
          rate: 0.19,
          isIncluded: true,
          isActive: true,
          taxTypeCode: "VAT",
          calculationMethodCode: "PERCENTAGE",
        },
      ],
      listProductCategories: async () => [
        {
          id: "fiscal-general",
          code: "GENERAL",
          name: "Producto general",
          isActive: true,
          isAlcoholicBeverage: false,
        },
      ],
      listActiveCategoryRateLinks: async () => [],
    } as never,
    {
      findMany: async () => [],
      findBySlug: async () => null,
    } as never,
    {
      findMany: async () => [],
      findBySlug: async () => null,
    } as never,
    {
      create: async (input: { name: string }) => {
        calls.push(["createCategory", input]);
        return { id: "cat-new" };
      },
    } as never,
    {
      create: async (input: unknown) => {
        calls.push(["createSubcategory", input]);
        return { id: "sub-new" };
      },
    } as never,
    {
      createProduct: async (input: { sku: string }) => {
        calls.push(["createProduct", input]);
        if (input.sku === options.failCreateSku) {
          throw new BadRequestException("sku already exists for this tenant");
        }
        createdCount += 1;
        return { id: `prod-new-${createdCount}` };
      },
      updateProduct: async (id: string, tenantId: string, data: unknown) => {
        calls.push(["updateProduct", { id, tenantId, data }]);
        return { id };
      },
      changePrice: async (
        id: string,
        tenantId: string,
        userId: string,
        data: unknown
      ) => {
        calls.push(["changePrice", { id, userId, data }]);
        return {};
      },
    } as never,
    {
      create: async (input: unknown) => {
        calls.push(["createBarcode", input]);
        return {};
      },
    } as never,
    {
      create: async (input: unknown) => {
        calls.push(["stockAdjustment", input]);
        return {};
      },
    } as never,
    {
      canAccessBranch: async () => true,
    } as never
  );

  return { service, calls };
}

const actor = { id: "user-1", tenantId: "tenant-1", roles: ["ADMIN"] };

describe("ProductImportService", () => {
  it("validate returns the resolved report", async () => {
    const { service } = buildService();
    const file = await buildFile([["A-1", "Uno", "UND", 1000, 600, 19]]);

    const result = await service.validate("tenant-1", actor, file);

    assert.equal(result.report.canCommit, true);
    assert.equal(result.report.rows[0].taxes?.[0].taxId, "tax-iva19");
  });

  it("commit rejects files with errors and writes nothing", async () => {
    const { service, calls } = buildService();
    const file = await buildFile([["A-1", "Uno", "CAJA", 1000, 600, 19]]);

    await assert.rejects(
      service.commit("tenant-1", actor, file),
      BadRequestException
    );
    assert.deepEqual(calls, []);
  });

  it("commit creates categories once and processes rows in order", async () => {
    const { service, calls } = buildService({
      existingProducts: [
        {
          id: "prod-existing",
          sku: "B-2",
          price: 500,
          saleType: "UNIT",
          measurementUnit: "UND",
          requiresLot: false,
          requiresExpiration: false,
          isPerishable: false,
          categoryId: null,
          subcategoryId: null,
        },
      ],
    });
    const file = await buildFile([
      ["A-1", "Uno", "UND", 1000, 600, 19, "Aseo", 3],
      ["B-2", "Dos", "", 700, "", "", "aseo"],
    ]);

    const result = await service.commit("tenant-1", actor, file);

    assert.deepEqual(result.summary, {
      total: 2,
      succeeded: 2,
      failed: 0,
      createdCategories: 1,
      createdSubcategories: 0,
    });
    assert.deepEqual(
      calls.map(([name]) => name),
      [
        "createCategory",
        "createProduct",
        "stockAdjustment",
        "updateProduct",
        "changePrice",
      ]
    );

    const created = calls[1][1] as Record<string, unknown>;
    assert.equal(created.categoryId, "cat-new");
    assert.deepEqual(created.taxes, [
      { taxId: "tax-iva19", calculationOrder: 100, isIncluded: true },
    ]);

    const stock = calls[2][1] as Record<string, unknown>;
    assert.equal(stock.productId, "prod-new-1");
    assert.equal(stock.branchId, "branch-1");
    assert.equal(stock.type, "IN");
    assert.equal(stock.quantity, 3);

    const updated = calls[3][1] as { id: string; data: Record<string, unknown> };
    assert.equal(updated.id, "prod-existing");
    assert.equal(updated.data.categoryId, "cat-new");
    assert.equal("price" in updated.data, false);
    assert.equal("taxes" in updated.data, false);

    const priceChange = calls[4][1] as { data: { newPrice: number; reason: string } };
    assert.deepEqual(priceChange.data, {
      newPrice: 700,
      reason: "Carga inicial xlsx",
    });
  });

  it("reports row failures without stopping the rest", async () => {
    const { service } = buildService({ failCreateSku: "A-1" });
    const file = await buildFile([
      ["A-1", "Uno", "UND", 1000, 600, 19],
      ["C-3", "Tres", "UND", 1000, 600, 19],
    ]);

    const result = await service.commit("tenant-1", actor, file);

    assert.equal(result.summary.failed, 1);
    assert.equal(result.rows[0].status, "FAILED");
    assert.match(result.rows[0].message, /falló al crear producto: sku already exists/);
    assert.equal(result.rows[1].status, "OK");
  });

  it("builds a template that the parser accepts", async () => {
    const { service } = buildService();

    const template = await service.buildTemplate("tenant-1");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template as unknown as ArrayBuffer);

    assert.deepEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      ["Productos", "Catalogos", "Instrucciones"]
    );
    const headers = (workbook.getWorksheet("Productos")?.getRow(1).values ??
      []) as unknown[];
    assert.deepEqual(
      headers.slice(1),
      PRODUCT_IMPORT_COLUMNS.map((column) => column.key)
    );
    await assert.rejects(
      parseProductImportWorkbook(template),
      /no tiene filas con datos/
    );
  });
});
