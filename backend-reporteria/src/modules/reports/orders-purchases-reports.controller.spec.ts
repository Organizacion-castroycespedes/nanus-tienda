import assert from "node:assert/strict";
import test from "node:test";
import { getReportRoles } from "../auth/report-roles.decorator";
import { OrdersReportsController } from "./orders-reports.controller";
import { PurchasesReportsController } from "./purchases-reports.controller";

const operationalRoles = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];

test("OrdersReportsController: lista y ticket permiten roles operativos", () => {
  assert.deepEqual(getReportRoles(OrdersReportsController.prototype.getOrderSales), operationalRoles);
  assert.deepEqual(getReportRoles(OrdersReportsController.prototype.getOrderSaleTicket), operationalRoles);
});

test("PurchasesReportsController: lista y ticket permiten roles operativos", () => {
  assert.deepEqual(getReportRoles(PurchasesReportsController.prototype.getPurchases), operationalRoles);
  assert.deepEqual(getReportRoles(PurchasesReportsController.prototype.getPurchaseTicket), operationalRoles);
});
