import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOperationalDashboardQuery } from "./operational-dashboard-query.dto";

test("dashboard periods are server-normalized", () => {
  const today = new Date("2026-09-12T12:00:00.000Z");
  assert.deepEqual(normalizeOperationalDashboardQuery({ period: "LAST_7_DAYS" }, today), { period: "LAST_7_DAYS", dateFrom: "2026-09-06", dateTo: "2026-09-12" });
  assert.deepEqual(normalizeOperationalDashboardQuery({ period: "CUSTOM", dateFrom: "2026-09-01", dateTo: "2026-09-03", branchId: "b1" }, today), { period: "CUSTOM", dateFrom: "2026-09-01", dateTo: "2026-09-03", branchId: "b1" });
});

test("dashboard rejects invalid or incomplete custom periods", () => {
  assert.throws(() => normalizeOperationalDashboardQuery({ period: "CUSTOM", dateFrom: "2026-09-03", dateTo: "2026-09-01" }));
  assert.throws(() => normalizeOperationalDashboardQuery({ period: "NOPE" }));
});
