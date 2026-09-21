import assert from "node:assert/strict";
import test from "node:test";
import { InventoryRepository } from "./inventory.repository";

test("InventoryRepository.getInventoryCostTotal uses product cost times scoped stock", async () => {
  let sql = "";
  let params: unknown[] = [];
  const repository = new InventoryRepository({
    query: async (query: string, values: unknown[]) => {
      sql = query;
      params = values;
      return { rows: [{ inventory_cost_total: "150.50" }] };
    },
  } as never);

  assert.equal(
    await repository.getInventoryCostTotal({
      tenantId: "tenant-1",
      branchId: "branch-1",
      terminalId: "terminal-1",
    }),
    150.5,
  );
  assert.match(sql, /balance\.stock \* product\.cost/);
  assert.deepEqual(params, ["tenant-1", "branch-1", "terminal-1"]);
});

test("InventoryRepository.getInventoryCostTotal maps null database totals to zero", async () => {
  const repository = new InventoryRepository({
    query: async () => ({ rows: [{ inventory_cost_total: null }] }),
  } as never);

  assert.equal(
    await repository.getInventoryCostTotal({ tenantId: "tenant-1" }),
    0,
  );
});
