import assert from "node:assert/strict";
import test from "node:test";
import { getReportRoles } from "../auth/report-roles.decorator";
import { CashReportsController } from "./cash-reports.controller";

test("CashReportsController: cash closing ticket permite USER con scope SQL", () => {
  assert.deepEqual(
    getReportRoles(CashReportsController.prototype.getCashClosingTicket),
    ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]
  );
});
