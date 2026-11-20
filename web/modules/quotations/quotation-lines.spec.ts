import assert from "node:assert/strict";
import test from "node:test";
import { addOrIncrementLine } from "./quotation-lines";

const cable = {
  id: "p-cable",
  name: "Cable 12 AWG",
  sku: "CAB-12",
  measurementUnit: "M",
  allowsDecimalQuantity: true,
  saleType: "UNIT",
  price: 1000,
} as never;
const bombillo = {
  id: "p-bombillo",
  name: "Bombillo",
  sku: "BOM",
  measurementUnit: "UND",
  allowsDecimalQuantity: false,
  saleType: "UNIT",
  price: 500,
} as never;

test("escanear dos veces el mismo producto deja cantidad 2 en una sola linea", () => {
  const first = addOrIncrementLine([], bombillo);
  assert.equal(first.lines.length, 1);
  assert.equal(first.line.quantity, 1);
  const second = addOrIncrementLine(first.lines, bombillo);
  assert.equal(second.lines.length, 1);
  assert.equal(second.line.quantity, 2);
  assert.equal(second.line.key, first.line.key);
});

test("otro producto agrega una linea nueva y respeta el orden", () => {
  const withBombillo = addOrIncrementLine([], bombillo).lines;
  const result = addOrIncrementLine(withBombillo, cable);
  assert.deepEqual(result.lines.map((line) => line.productId), ["p-bombillo", "p-cable"]);
  assert.equal(result.line.allowsDecimal, true);
  assert.equal(result.line.unitCode, "M");
});

test("producto con decimales suma 1 a la cantidad digitada", () => {
  const start = addOrIncrementLine([], cable).lines.map((line) => ({ ...line, quantity: 10.85 }));
  const result = addOrIncrementLine(start, cable);
  assert.equal(result.line.quantity, 11.85);
});
