import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("CashReportsPage selects the active tab document and keeps legacy actions", () => {
  const source = readFileSync(resolve(process.cwd(), "modules/reporteria/components/CashReportsPage.tsx"), "utf8");
  assert.match(source, /getCashClosingsReportPdf/);
  assert.match(source, /getCashAuditsReportPdf/);
  assert.match(source, /getCashClosingsReportExcel/);
  assert.match(source, /getCashAuditsReportExcel/);
  assert.match(source, /activeTab === "closings"/);
  assert.match(source, /\bReporte\b/);
  assert.match(source, /getCashClosingTicket/);
  assert.match(source, /getCashAuditTicket/);
});
