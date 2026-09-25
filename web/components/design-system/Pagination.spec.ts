import assert from "node:assert/strict";
import test from "node:test";
import { buildPaginationModel } from "./Pagination";

test("Pagination muestra estado vacío sin rango inválido", () => {
  assert.deepEqual(buildPaginationModel(1, 25, 0), { totalPages: 1, currentPage: 1, firstItem: 0, lastItem: 0, visiblePages: [1] });
});

test("Pagination corrige página fuera de rango y calcula rango visible", () => {
  assert.deepEqual(buildPaginationModel(99, 25, 73), { totalPages: 3, currentPage: 3, firstItem: 51, lastItem: 73, visiblePages: [1, 2, 3] });
});

test("Pagination conserva ventana numerada alrededor de la página", () => {
  assert.deepEqual(buildPaginationModel(8, 10, 200).visiblePages, [6, 7, 8, 9, 10]);
});
