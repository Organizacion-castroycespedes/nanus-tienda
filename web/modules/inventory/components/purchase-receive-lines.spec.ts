import assert from "node:assert/strict";
import test from "node:test";
import {
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
