import test from "node:test";
import assert from "node:assert/strict";
import { getReportRoles } from "../auth/report-roles.decorator";
import { CustomersReportsController } from "./customers-reports.controller";

test("customer report endpoints allow USER through report authorization", () => {
  assert.deepEqual(getReportRoles(CustomersReportsController.prototype.getCustomerMaster), ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]);
  assert.deepEqual(getReportRoles(CustomersReportsController.prototype.getCustomerOrdersStatus), ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]);
});
