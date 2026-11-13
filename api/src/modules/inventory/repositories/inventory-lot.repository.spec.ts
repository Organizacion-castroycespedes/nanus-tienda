import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { InventoryLotRepository } from "./inventory-lot.repository";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  branch: "00000000-0000-0000-0000-000000000002",
  product: "00000000-0000-0000-0000-000000000003",
  lot: "00000000-0000-0000-0000-000000000004",
};

type RecordedCall = { text: string; params: unknown[] };

const baseRow = {
  id: ids.lot,
  tenant_id: ids.tenant,
  branch_id: ids.branch,
  product_id: ids.product,
  supplier_id: null,
  purchase_id: null,
  purchase_item_id: null,
  lot_code: "l-10",
  expiration_date: "2027-12-13",
  received_at: "2026-11-13T00:00:00.000Z",
  unit_cost: "50000",
  status: "ACTIVE",
  is_legacy: false,
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
  const repository = new InventoryLotRepository({} as never);
  return { repository, client, calls };
};

test("InventoryLotRepository.findMany: agrega nombre y SKU con LEFT JOIN por tenant", async () => {
  const { repository, client, calls } = createRepository([
    { ...baseRow, product_name: "Aguardiente Amarillo 1000ml", product_sku: "AGUADIENTE003" },
  ]);

  const lots = await repository.findMany(ids.tenant, { branchId: ids.branch }, client);

  assert.equal(calls.length, 1);
  const sql = calls[0].text.replace(/\s+/g, " ");
  assert.match(sql, /LEFT JOIN products AS product/);
  assert.match(sql, /product\.id = lot\.product_id/);
  assert.match(sql, /product\.tenant_id = lot\.tenant_id/);
  assert.deepEqual(calls[0].params, [ids.tenant, ids.branch]);
  assert.equal(lots[0].productName, "Aguardiente Amarillo 1000ml");
  assert.equal(lots[0].productSku, "AGUADIENTE003");
  assert.equal(lots[0].lotCode, "L-10");
});

test("InventoryLotRepository.findMany: producto inexistente devuelve nombre y SKU nulos", async () => {
  const { repository, client } = createRepository([
    { ...baseRow, product_name: null, product_sku: null },
  ]);

  const lots = await repository.findMany(ids.tenant, {}, client);

  assert.equal(lots.length, 1);
  assert.equal(lots[0].productName, null);
  assert.equal(lots[0].productSku, null);
});

test("InventoryLotRepository.findById: no consulta productos ni expone campos nuevos", async () => {
  const { repository, client, calls } = createRepository([baseRow]);

  const lot = await repository.findById(ids.tenant, ids.lot, client);

  assert.doesNotMatch(calls[0].text, /products/);
  assert.ok(lot);
  assert.equal(Object.prototype.hasOwnProperty.call(lot, "productName"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(lot, "productSku"), false);
});

test("InventoryLotRepository.findTraceability: filtra por tenant y lote en las tres consultas", async () => {
  const calls: RecordedCall[] = [];
  const responses = [
    [
      {
        balance_id: "b1",
        location_id: "loc1",
        location_code: "002",
        location_name: "Licores",
        location_is_active: true,
        quantity_on_hand: "5",
        quantity_reserved: "0",
        quantity_available: "5",
        last_movement_at: "2026-11-12T00:00:00.000Z",
      },
    ],
    [
      {
        purchase_id: "p1",
        supplier_name: "Stephany",
        supplier_invoice_number: "FV-1",
        supplier_invoice_date: "2026-11-12",
        received_quantity: "5",
        unit_cost: "50000",
        first_received_at: "2026-11-12T00:00:00.000Z",
        is_origin: true,
      },
    ],
    [
      {
        id: "m1",
        occurred_at: "2026-11-12T00:00:00.000Z",
        type: "IN",
        quantity: "5",
        reference_type: "PURCHASE",
        reference_table: "purchases",
        reference_id: "p1",
        location_code: "002",
        location_name: "Licores",
        document_label: "FV-1",
      },
    ],
  ];
  const client = {
    query: async (text: string, params: unknown[] = []) => {
      calls.push({ text, params });
      return { rows: responses[calls.length - 1] };
    },
  } as unknown as PoolClient;
  const repository = new InventoryLotRepository({} as never);

  const result = await repository.findTraceability(
    ids.tenant,
    { id: ids.lot, productId: ids.product, purchaseId: null },
    client
  );

  assert.equal(calls.length, 3);
  calls.forEach((call) => {
    assert.equal(call.params[0], ids.tenant);
    assert.equal(call.params[1], ids.lot);
    assert.match(call.text, /tenant_id = \$1/);
  });
  assert.match(calls[1].text.replace(/\s+/g, " "), /supplier\.tenant_id = purchase\.tenant_id/);
  assert.equal(result.locations[0].quantityAvailable, 5);
  assert.equal(result.purchases[0].supplierName, "Stephany");
  assert.equal(result.purchases[0].isOrigin, true);
  assert.equal(result.movements[0].type, "IN");
  assert.equal(result.movements[0].documentLabel, "FV-1");
  assert.equal(result.movementsTruncated, false);
});

test("InventoryLotRepository.findTraceability: limita los movimientos e indica truncado", async () => {
  const many = Array.from({ length: 201 }, (_, index) => ({
    id: `m${index}`,
    occurred_at: "2026-11-12T00:00:00.000Z",
    type: "OUT",
    quantity: "1",
    reference_type: "SALE",
    reference_table: "sales",
    reference_id: null,
    location_code: null,
    location_name: null,
    document_label: null,
  }));
  let call = 0;
  const client = {
    query: async () => {
      call += 1;
      return { rows: call === 3 ? many : [] };
    },
  } as unknown as PoolClient;
  const repository = new InventoryLotRepository({} as never);

  const result = await repository.findTraceability(
    ids.tenant,
    { id: ids.lot, productId: ids.product, purchaseId: null },
    client
  );

  assert.equal(result.movements.length, 200);
  assert.equal(result.movementsTruncated, true);
});
