import assert from "node:assert/strict";
import test from "node:test";
import { InventoryRepository } from "./inventory.repository";

test("InventoryRepository.getInventoryCostTotal uses product cost times scoped stock", async () => {
  let sql = "";
  let params: unknown[] = [];
  const repository = new InventoryRepository({
    query: async (query: string, values: unknown[]) => {
      sql = query;
      params = values;
      return { rows: [{ inventory_cost_total: "150.50" }] };
    },
  } as never);

  assert.equal(
    await repository.getInventoryCostTotal({
      tenantId: "tenant-1",
      branchId: "branch-1",
      terminalId: "terminal-1",
    }),
    150.5,
  );
  assert.match(sql, /balance\.stock \* product\.cost/);
  assert.deepEqual(params, ["tenant-1", "branch-1", "terminal-1"]);
});

test("InventoryRepository.getInventoryCostTotal maps null database totals to zero", async () => {
  const repository = new InventoryRepository({
    query: async () => ({ rows: [{ inventory_cost_total: null }] }),
  } as never);

  assert.equal(
    await repository.getInventoryCostTotal({ tenantId: "tenant-1" }),
    0,
  );
});

test("InventoryRepository searches the full scoped product set before applying the limit", async () => {
  let sql = "";
  let params: unknown[] = [];
  const repository = new InventoryRepository({
    query: async (query: string, values: unknown[]) => {
      sql = query;
      params = values;
      return { rows: [] };
    },
  } as never);

  await repository.listInventoryProducts({
    tenantId: "tenant-1",
    branchId: "branch-1",
    search: "needle",
    limit: 2,
  });

  assert.match(sql, /p\.name ILIKE \$3 OR p\.sku ILIKE \$3/);
  assert.match(sql, /ORDER BY[\s\S]*LIMIT \$4/);
  assert.deepEqual(params, ["tenant-1", "branch-1", "%needle%", 2]);
});

test("InventoryRepository keeps the legacy unbounded query when search and limit are omitted", async () => {
  let sql = "";
  const repository = new InventoryRepository({
    query: async (query: string) => {
      sql = query;
      return { rows: [] };
    },
  } as never);

  await repository.listInventoryProducts({ tenantId: "tenant-1" });

  assert.doesNotMatch(sql, /ILIKE/);
  assert.doesNotMatch(sql, /LIMIT \$/);
});

test("InventoryRepository summarizes the scoped BI base with contractual stock and cost semantics", async () => {
  let sql = "";
  let params: unknown[] = [];
  const repository = new InventoryRepository({
    query: async (query: string, values: unknown[]) => {
      sql = query;
      params = values;
      return {
        rows: [{
          total_inventory_cost: "150.50",
          total_inventory_units: "3.50",
          products_with_stock: "1",
          out_of_stock_products: "1",
          negative_stock_products: "1",
        }],
      };
    },
  } as never);

  const result = await repository.getInventoryBiSummary({
    tenantId: "tenant-1",
    branchId: "branch-1",
    productIds: ["product-1", "product-2"],
    categoryId: "category-1",
    stockStatus: "negative",
  });

  assert.deepEqual(result, [{
    total_inventory_cost: "150.50",
    total_inventory_units: "3.50",
    products_with_stock: "1",
    out_of_stock_products: "1",
    negative_stock_products: "1",
  }][0]);
  assert.match(sql, /FROM public\.inventory_bi_base\(/);
  assert.match(sql, /COUNT\(DISTINCT product_id\)/);
  assert.match(sql, /inventory_cost/);
  assert.match(sql, /real_stock/);
  assert.match(sql, /negative_stock_products/);
  assert.match(sql, /COUNT\(DISTINCT product_id\)/);
  assert.deepEqual(params, ["tenant-1", ["branch-1"], ["product-1", "product-2"], "category-1", "negative"]);
});

test("InventoryRepository reuses the BI base for capital distributions and keeps small aggregates", async () => {
  let sql = "";
  const repository = new InventoryRepository({
    query: async (query: string) => {
      sql = query;
      return {
        rows: [{
          branch_distribution: [{ branchId: "branch-1", totalCost: "100.00" }],
          category_distribution: [{ categoryId: null, categoryName: "Sin categoría", totalCost: "100.00" }],
          top_products: [{
            rank: 1,
            productId: "product-1",
            productName: "Producto",
            sku: "SKU-1",
            totalCost: "100.00",
            participationPercent: "100.0000",
          }],
        }],
      };
    },
  } as never);

  const result = await repository.getInventoryBiCapitalDistribution({
    tenantId: "tenant-1",
    branchIds: ["branch-1"],
    stockStatus: "all",
  });

  assert.equal(result.category_distribution[0].categoryName, "Sin categoría");
  assert.match(sql, /FROM public\.inventory_bi_base\(/);
  assert.match(sql, /LIMIT 5/);
  assert.match(sql, /ORDER BY total_cost DESC, product_id/);
  assert.match(sql, /GROUP BY product_id/);
  assert.match(sql, /NULLIF\(\(SELECT total_cost FROM total\), 0\)/);
});
