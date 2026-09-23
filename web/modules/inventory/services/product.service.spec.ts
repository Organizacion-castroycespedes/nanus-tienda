import assert from "node:assert/strict";
import test from "node:test";
import { buildInventoryProductsQuery } from "./product.service";

test("buildInventoryProductsQuery preserves the legacy array route when options are omitted", () => {
  assert.equal(
    buildInventoryProductsQuery({ tenantId: "tenant-1", branchId: "branch-1" }),
    "/inventory/products?tenantId=tenant-1&branchId=branch-1"
  );
});

test("buildInventoryProductsQuery sends remote search and bounded limit", () => {
  const query = buildInventoryProductsQuery({
    tenantId: "tenant-1",
    branchId: "branch-1",
    search: "SKU 42",
    limit: 25,
  });

  assert.equal(
    query,
    "/inventory/products?tenantId=tenant-1&branchId=branch-1&search=SKU+42&limit=25"
  );
});
