import assert from "node:assert/strict";
import test from "node:test";
import { getReportRoles } from "../auth/report-roles.decorator";
import { CurrentShiftReportsController } from "./current-shift-reports.controller";

test("CurrentShiftReportsController: current shift permite roles operativos", () => {
  assert.deepEqual(
    getReportRoles(CurrentShiftReportsController.prototype.getCurrentShift),
    ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]
  );
});
