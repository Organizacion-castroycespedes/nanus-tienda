import assert from "node:assert/strict";
import test from "node:test";
import { InventoryBiValuationReportsController } from "./inventory-bi-valuation-reports.controller";

test("inventory valuation export forwards applied filters and actor", async () => {
  const calls: unknown[][] = [];
  const service = {
    createPackage: async (...args: unknown[]) => {
      calls.push(args);
      return { dataset: { rows: [] }, pdfBase64: "pdf" };
    },
  };
  const controller = new InventoryBiValuationReportsController(service as never);
  const body = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    branchId: "30000000-0000-4000-8000-000000000001",
    productIds: [],
    categoryId: undefined,
    stockStatus: "all" as const,
    mode: "export" as const,
  };
  const user = { id: "40000000-0000-4000-8000-000000000001", tenantId: body.tenantId,
    branchId: null, roles: ["ADMIN"] };
  await controller.create(body, { user } as never);
  assert.deepEqual(calls, [[body, user]]);
});
