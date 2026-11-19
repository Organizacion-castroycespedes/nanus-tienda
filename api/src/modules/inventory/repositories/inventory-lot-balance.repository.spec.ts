import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { InventoryLotBalanceRepository } from "./inventory-lot-balance.repository";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  branch: "00000000-0000-0000-0000-000000000002",
  product: "00000000-0000-0000-0000-000000000003",
  lot: "00000000-0000-0000-0000-000000000004",
  balance: "00000000-0000-0000-0000-000000000005",
  location: "00000000-0000-0000-0000-000000000006",
};

type RecordedCall = { text: string; params: unknown[] };

const baseRow = {
  id: ids.balance,
  tenant_id: ids.tenant,
  branch_id: ids.branch,
  product_id: ids.product,
  lot_id: ids.lot,
  location_id: ids.location,
  quantity_on_hand: "5",
  quantity_reserved: "0",
  quantity_available: "5",
  last_movement_at: null,
  created_at: "2026-11-13T00:00:00.000Z",
  updated_at: "2026-11-13T00:00:00.000Z",
};

const createRepository = (rows: Record<string, unknown>[]) => {
  const calls: RecordedCall[] = [];
  const client = {
    query: async (text: string, params: unknown[] = []) => {
      calls.push({ text, params });
      return { rows };
    },
  } as unknown as PoolClient;
  const repository = new InventoryLotBalanceRepository({} as never);
  return { repository, client, calls };
};

test("InventoryLotBalanceRepository.findMany: agrega nombre y SKU con LEFT JOIN por tenant", async () => {
  const { repository, client, calls } = createRepository([
    { ...baseRow, product_name: "Leche 1L", product_sku: "LCH-1" },
  ]);

  const balances = await repository.findMany(
    ids.tenant,
    { branchId: ids.branch, locationId: ids.location, onlyAvailable: true },
    client
  );

  const sql = calls[0].text.replace(/\s+/g, " ");
  assert.match(sql, /LEFT JOIN products AS product/);
  assert.match(sql, /product\.id = balance\.product_id/);
  assert.match(sql, /product\.tenant_id = balance\.tenant_id/);
  assert.match(sql, /balance\.quantity_available > 0/);
  assert.deepEqual(calls[0].params, [ids.tenant, ids.branch, ids.location]);
  assert.equal(balances[0].productName, "Leche 1L");
  assert.equal(balances[0].productSku, "LCH-1");
  assert.equal(balances[0].quantityAvailable, 5);
});

test("InventoryLotBalanceRepository.findMany: producto inexistente devuelve nulos", async () => {
  const { repository, client } = createRepository([
    { ...baseRow, product_name: null, product_sku: null },
  ]);

  const balances = await repository.findMany(ids.tenant, {}, client);

  assert.equal(balances[0].productName, null);
  assert.equal(balances[0].productSku, null);
});

test("InventoryLotBalanceRepository.findById: no consulta productos ni expone campos nuevos", async () => {
  const { repository, client, calls } = createRepository([baseRow]);

  const balance = await repository.findById(ids.tenant, ids.balance, client);

  assert.doesNotMatch(calls[0].text, /products/);
  assert.ok(balance);
  assert.equal(Object.prototype.hasOwnProperty.call(balance, "productName"), false);
});
