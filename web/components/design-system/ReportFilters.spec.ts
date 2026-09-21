import test from "node:test";
import assert from "node:assert/strict";
import { getActiveReportFilters } from "./ReportFilters";

test("ReportFilters keeps secondary filters behind one compact control", () => {
  const active = getActiveReportFilters([
    { key: "date", label: "Fecha", priority: "primary", active: true, render: () => "date", clear: () => undefined },
    { key: "branch", label: "Sucursal", priority: "secondary", active: true, activeLabel: "Principal", render: () => "branch", clear: () => undefined },
    { key: "tenant", label: "Tenant", priority: "secondary", active: false, render: () => "tenant", clear: () => undefined },
  ]);

  assert.deepEqual(active.map((filter) => filter.key), ["branch"]);
});
