import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInventoryBiFilters,
  resetInventoryBiFilters,
  removeInventoryProduct,
  selectInventoryBranch,
  selectInventoryTenant,
  toggleInventoryProduct,
} from "./inventoryBiFilters";

const defaults = {
  requestedTenantId: "tenant-1",
  requestedBranchId: "branch-1",
  startDate: "2026-09-21",
  endDate: "2026-09-21",
};

describe("Inventory BI filter state", () => {
  it("keeps only the contractual default fields on creation", () => {
    assert.deepEqual(createInventoryBiFilters(defaults), {
      ...defaults,
      productIds: [],
      categoryId: "",
      stockStatus: "all",
      terminalId: "",
      cashSessionId: "",
    });
  });

  it("clears dependent selections when tenant changes", () => {
    const current = {
      ...createInventoryBiFilters(defaults),
      productIds: ["product-1", "product-2"],
      categoryId: "category-1",
      terminalId: "terminal-1",
      cashSessionId: "cash-1",
    };

    assert.deepEqual(selectInventoryTenant(current, "tenant-2"), {
      ...current,
      requestedTenantId: "tenant-2",
      requestedBranchId: "",
      productIds: [],
      categoryId: "",
      terminalId: "",
      cashSessionId: "",
    });
  });

  it("clears product and operational selections when branch changes", () => {
    const current = {
      ...createInventoryBiFilters(defaults),
      productIds: ["product-1", "product-2"],
      terminalId: "terminal-1",
      cashSessionId: "cash-1",
    };

    assert.deepEqual(selectInventoryBranch(current, "branch-2"), {
      ...current,
      requestedBranchId: "branch-2",
      productIds: [],
      terminalId: "",
      cashSessionId: "",
    });
  });

  it("resets optional filters without widening the required scope", () => {
    assert.deepEqual(
      resetInventoryBiFilters(defaults),
      createInventoryBiFilters(defaults)
    );
  });

  it("toggles product IDs without duplicates and removes one selection", () => {
    const current = createInventoryBiFilters(defaults);
    const selected = toggleInventoryProduct(
      toggleInventoryProduct(current, "product-1"),
      "product-1"
    );
    const withTwo = toggleInventoryProduct(selected, "product-1");

    assert.deepEqual(withTwo.productIds, ["product-1"]);
    assert.deepEqual(removeInventoryProduct(
      toggleInventoryProduct(withTwo, "product-2"),
      "product-1"
    ).productIds, ["product-2"]);
  });
});
