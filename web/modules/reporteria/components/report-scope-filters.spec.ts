import test from "node:test";
import assert from "node:assert/strict";
import { createReportScopeFilters } from "./report-scope-filters";

test("report scope metadata keeps date primary and tenant/branch secondary", () => {
  const filters = createReportScopeFilters({
    dateRange: { from: "2026-09-20", to: "2026-09-20" },
    initialRange: { from: "2026-09-20", to: "2026-09-20" },
    setDateRange: () => undefined,
    showTenantSelector: true,
    showBranchSelector: true,
    tenantId: "tenant-1",
    branchId: "branch-1",
    setTenantId: () => undefined,
    setBranchId: () => undefined,
    tenantOptions: [{ value: "tenant-1", label: "Principal" }],
    branchOptions: [{ value: "branch-1", label: "Principal" }],
    loadingTenants: false,
    loadingBranches: false,
    tenantLabel: "Principal",
    branchLabel: "Principal",
  });

  assert.deepEqual(filters.map((filter) => [filter.key, filter.priority]), [
    ["date", "primary"],
    ["tenant", "secondary"],
    ["branch", "secondary"],
  ]);
});
