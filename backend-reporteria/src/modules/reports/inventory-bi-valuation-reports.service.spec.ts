import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { InventoryBiValuationReportsService } from "./inventory-bi-valuation-reports.service";

const tenantId = "00000000-0000-4000-8000-000000000001";
const branchId = "30000000-0000-4000-8000-000000000001";
const productId = "20000000-0000-4000-8000-000000000001";

test("inventory valuation export reads full filtered dataset and preserves decimal strings", async () => {
  const sql: string[] = [];
  const client = {
    query: async (text: string) => {
      sql.push(text);
      if (text.startsWith("SELECT COUNT")) {
        return { rows: [{ total_rows: "2", total_cost: "303.7400", total_units: "12.50" }] };
      }
      if (text.includes("FROM tenants AS t")) {
        return { rows: [{ name: "Empresa", legal_name: null, nit: null, address: null, phone: null, config: null }] };
      }
      if (text.includes("FROM tenant_branches")) return { rows: [{ name: "Principal" }] };
      return { rows: [
        { tenant_id: tenantId, branch_id: branchId, product_id: productId, product_name: "Producto A",
          sku: "SKU-A", category_id: null, category_name: null, branch_name: "Principal",
          real_stock: "-1.25", real_unit_cost: "10.00", inventory_cost: "-12.5000",
          participation_percent: "-4.1132", stock_status: "NEGATIVE" },
        { tenant_id: tenantId, branch_id: branchId, product_id: "20000000-0000-4000-8000-000000000002", product_name: "Producto B",
          sku: "SKU-B", category_id: null, category_name: null, branch_name: "Principal",
          real_stock: "13.75", real_unit_cost: "23.00", inventory_cost: "316.2400",
          participation_percent: "104.1132", stock_status: "WITH_STOCK" },
      ] };
    },
    release: () => undefined,
  };
  const service = new InventoryBiValuationReportsService(
    { resolve: async () => ({ tenantId, branchIds: [branchId] }) } as never,
    {
      getClient: async () => client,
      query: async () => ({ rows: [{ name: "Empresa", legal_name: null, nit: null,
        address: null, phone: null, config: null }] }),
    } as never,
    { collectWithSummary: async (count: any, read: any) => {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const counted = await count(client);
      const rows = await read(client, 0, 1000);
      await client.query("COMMIT");
      return { rows, summary: counted.summary };
    } } as never,
    { generatePdf: async () => Buffer.from("pdf") } as never,
  );
  const result = await service.createPackage({ tenantId, branchId, productIds: [], stockStatus: "all", mode: "export" },
    { id: "40000000-0000-4000-8000-000000000001", tenantId, branchId: null, roles: ["ADMIN"] });
  assert.equal(result.dataset.rows.length, 2);
  assert.equal(result.dataset.summary.totalCost, "303.7400");
  assert.equal(result.dataset.rows[0].inventoryCost, "-12.5000");
  assert.deepEqual(result.dataset.filters, {
    Empresa: "Empresa",
    Sucursal: "Principal",
    Productos: "Todos los productos",
    Categoría: "Todas las categorías",
    "Estado de stock": "Todos",
  });
  assert.ok(sql.some((statement) => statement.includes("public.inventory_bi_base")));
  assert.ok(result.xlsxBase64);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(result.xlsxBase64!, "base64"));
  const detail = workbook.getWorksheet("Detalle")!;
  assert.equal(detail.getCell(2, 9).value, "Stock negativo");
  assert.equal(detail.getCell(3, 9).value, "Con stock");
  assert.equal(detail.getCell(2, 8).value, "-4,11%");
  assert.equal(detail.getCell(3, 8).value, "104,11%");
  assert.doesNotMatch(String(detail.getCell(2, 9).value), /WITH_STOCK|OUT_OF_STOCK|NEGATIVE/);
});
