import assert from "node:assert/strict";
import test from "node:test";
import { buildInventoryBiSummaryQuery } from "./dashboard.service";

test("buildInventoryBiSummaryQuery omits empty product and all-status filters", () => {
  assert.equal(
    buildInventoryBiSummaryQuery({ tenantId: "tenant-1", productIds: [], stockStatus: "all" }),
    "?tenantId=tenant-1"
  );
});

test("buildInventoryBiSummaryQuery sends the complete selected product scope", () => {
  assert.equal(
    buildInventoryBiSummaryQuery({
      tenantId: "tenant-1",
      branchId: "branch-1",
      productIds: ["product-1", "product-2"],
      categoryId: "category-1",
      stockStatus: "negative",
    }),
    "?tenantId=tenant-1&branchId=branch-1&productIds=product-1%2Cproduct-2&categoryId=category-1&stockStatus=negative"
  );
});
