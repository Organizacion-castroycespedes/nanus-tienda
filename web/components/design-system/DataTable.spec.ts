import test from "node:test";
import assert from "node:assert/strict";
import { orderDataTableColumns } from "./DataTable";

const columns = [
  { key: "date", header: "Fecha", render: () => null },
  { key: "actions", header: "Acciones", render: () => null },
  { key: "amount", header: "Total", render: () => null },
];

test("DataTable moves actions first only with the explicit opt-in", () => {
  assert.deepEqual(orderDataTableColumns(columns).map((column) => column.key), ["date", "actions", "amount"]);
  assert.deepEqual(orderDataTableColumns(columns, true).map((column) => column.key), ["actions", "date", "amount"]);
});

test("DataTable honors the per-column actionFirst opt-in", () => {
  assert.deepEqual(orderDataTableColumns([
    columns[0],
    { ...columns[1], actionFirst: true },
    columns[2],
  ]).map((column) => column.key), ["actions", "date", "amount"]);
});
