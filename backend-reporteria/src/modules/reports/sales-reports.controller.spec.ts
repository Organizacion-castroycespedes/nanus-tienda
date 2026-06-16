import assert from "node:assert/strict";
import test from "node:test";
import { getReportRoles } from "../auth/report-roles.decorator";
import { SalesReportsController } from "./sales-reports.controller";

test("SalesReportsController: POS sale ticket permite roles operativos", () => {
  assert.deepEqual(
    getReportRoles(SalesReportsController.prototype.getSaleTicket),
    ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]
  );
});
