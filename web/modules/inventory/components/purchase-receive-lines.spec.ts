import assert from "node:assert/strict";
import test from "node:test";
import {
  addQuantityToReceiveItem,
  createReceiveEntry,
  getItemsExceedingPending,
  getItemsWithDuplicateLots,
  getPreparedQuantityByItem,
  getReceivableEntries,
  removeReceiveEntry,
  splitReceiveItem,
  type ReceiveEntryValue,
  getPendingQuantity,
  getPendingReceiveRows,
  getReceiveQuantity,
  getRowsWithReceivableQuantity,
  hasAnyPositiveReceiveQuantity,
  type PurchaseReceiveLineInput,
} from "./purchase-receive-lines";

const lines: PurchaseReceiveLineInput[] = [
  {
    id: "rice",
    orderedQuantity: 15,
    receivedQuantity: 15,
  },
  {
    id: "sugar",
    orderedQuantity: 15,
    receivedQuantity: 0,
  },
  {
    id: "coffee",
    orderedQuantity: 20,
    receivedQuantity: 5,
  },
];

test("getPendingReceiveRows oculta lineas completamente recibidas", () => {
  const rows = getPendingReceiveRows(lines);

  assert.deepEqual(
    rows.map((row) => row.item.id),
    ["sugar", "coffee"]
  );
  assert.deepEqual(
    rows.map((row) => row.pending),
    [15, 15]
  );
});

test("getPendingReceiveRows conserva indice original para estado del formulario", () => {
  const rows = getPendingReceiveRows(lines);

  assert.deepEqual(
    rows.map((row) => row.index),
    [1, 2]
  );
});

test("getRowsWithReceivableQuantity solo devuelve lineas con cantidad positiva valida", () => {
  const rows = getPendingReceiveRows(lines);
  const values = [
    { quantity: "99" },
    { quantity: "15" },
    { quantity: "" },
  ];

  const receivableRows = getRowsWithReceivableQuantity(rows, values);

  assert.deepEqual(
    receivableRows.map((row) => row.item.id),
    ["sugar"]
  );
});

test("getRowsWithReceivableQuantity excluye cantidad mayor al pendiente", () => {
  const rows = getPendingReceiveRows(lines);
  const values = [
    { quantity: "" },
    { quantity: "16" },
    { quantity: "3" },
  ];

  const receivableRows = getRowsWithReceivableQuantity(rows, values);

  assert.deepEqual(
    receivableRows.map((row) => row.item.id),
    ["coffee"]
  );
});

test("hasAnyPositiveReceiveQuantity ignora lineas ocultas y cantidades vacias", () => {
  const rows = getPendingReceiveRows(lines);

  assert.equal(hasAnyPositiveReceiveQuantity(rows, [{ quantity: "10" }]), false);
  assert.equal(
    hasAnyPositiveReceiveQuantity(rows, [
      { quantity: "" },
      { quantity: "0" },
      { quantity: "0.5" },
    ]),
    true
  );
});

test("getPendingQuantity nunca devuelve pendiente negativo", () => {
  assert.equal(
    getPendingQuantity({
      id: "over-received",
      orderedQuantity: 10,
      receivedQuantity: 12,
    }),
    0
  );
});

test("getReceiveQuantity trata vacio o invalido como cero", () => {
  assert.equal(getReceiveQuantity({ quantity: "" }), 0);
  assert.equal(getReceiveQuantity({ quantity: "no-number" }), 0);
  assert.equal(getReceiveQuantity({ quantity: "1.25" }), 1.25);
});

const receiveItems: PurchaseReceiveLineInput[] = [
  { id: "item-a", orderedQuantity: 10, receivedQuantity: 0 },
  { id: "item-b", orderedQuantity: 5, receivedQuantity: 3 },
];

const entry = (key: string, purchaseItemId: string, quantity = "", lotCode = ""): ReceiveEntryValue => ({
  key,
  purchaseItemId,
  productId: `p-${purchaseItemId}`,
  quantity,
  lotCode,
  expirationDate: "",
  locationId: "",
  unitCost: "",
});

test("createReceiveEntry inicia vacia con el costo de la linea", () => {
  assert.deepEqual(createReceiveEntry({ id: "item-a", productId: "p", cost: 1200 }, "k1"), {
    key: "k1",
    purchaseItemId: "item-a",
    productId: "p",
    quantity: "",
    lotCode: "",
    expirationDate: "",
    locationId: "",
    unitCost: "1200",
  });
});

test("getPreparedQuantityByItem suma las entradas de cada linea sin deriva decimal", () => {
  const entries = [entry("1", "item-a", "0.1"), entry("2", "item-a", "0.2"), entry("3", "item-b", "1"), entry("4", "item-b", "")];
  assert.deepEqual(getPreparedQuantityByItem(entries), { "item-a": 0.3, "item-b": 1 });
});

test("addQuantityToReceiveItem suma al ultimo lote de la linea", () => {
  const entries = [entry("1", "item-a", "4", "L1"), entry("2", "item-a", "", "L2"), entry("3", "item-b")];
  const next = addQuantityToReceiveItem(entries, "item-a", 1);
  assert.deepEqual(next.map((item) => item.quantity), ["4", "1", ""]);
});

test("splitReceiveItem agrega un lote vacio conservando ubicacion y costo", () => {
  const source = { ...entry("1", "item-a", "6", "L1"), locationId: "loc-1", unitCost: "900" };
  const next = splitReceiveItem([source, entry("2", "item-b")], "item-a", "k-new");
  assert.equal(next.length, 3);
  assert.deepEqual(next[1], { ...source, key: "k-new", quantity: "", lotCode: "", expirationDate: "" });
  assert.equal(next[2].key, "2");
});

test("removeReceiveEntry nunca deja una linea sin entradas", () => {
  const entries = [entry("1", "item-a"), entry("2", "item-a"), entry("3", "item-b")];
  assert.deepEqual(removeReceiveEntry(entries, "2").map((item) => item.key), ["1", "3"]);
  assert.deepEqual(removeReceiveEntry(entries, "3").map((item) => item.key), ["1", "2", "3"]);
});

test("getItemsExceedingPending detecta lotes cuya suma supera el pendiente", () => {
  const entries = [entry("1", "item-a", "6"), entry("2", "item-a", "4"), entry("3", "item-b", "2"), entry("4", "item-b", "1")];
  assert.deepEqual(getItemsExceedingPending(receiveItems, entries), ["item-b"]);
});

test("getItemsWithDuplicateLots marca lotes repetidos en la misma linea", () => {
  const entries = [entry("1", "item-a", "2", "l1"), entry("2", "item-a", "1", "L1 "), entry("3", "item-b", "1", "L1")];
  assert.deepEqual(getItemsWithDuplicateLots(entries), ["item-a"]);
});

test("getReceivableEntries solo devuelve entradas con cantidad positiva", () => {
  const entries = [entry("1", "item-a", "2"), entry("2", "item-a", ""), entry("3", "item-b", "0")];
  assert.deepEqual(getReceivableEntries(entries).map((item) => item.key), ["1"]);
});
