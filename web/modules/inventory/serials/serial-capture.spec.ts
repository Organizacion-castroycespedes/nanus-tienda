import assert from "node:assert/strict";
import test from "node:test";
import {
  addSerials,
  formatSerialProgress,
  isWholeSerialQuantity,
  parseSerialText,
  removeSerial,
} from "./serial-capture";

test("parseSerialText reads one serial per line, first column and skips header", () => {
  assert.deepEqual(parseSerialText("Número de serie\nab-1\n\n cd/2 ;x\r\n\"EF.3\",y"), [
    "ab-1",
    "cd/2",
    "EF.3",
  ]);
});

test("addSerials normalizes, drops invalid and duplicates and respects the limit", () => {
  const result = addSerials(["A1"], ["a2", "a1", "bad serial", "A2", "a3", "a4"], 3, ["A3"]);
  assert.deepEqual(result.serials, ["A1", "A2", "A4"]);
  assert.deepEqual(result.added, ["A2", "A4"]);
  assert.deepEqual(result.invalid, ["bad serial"]);
  assert.deepEqual(result.duplicates, ["A1", "A2", "A3"]);
  assert.deepEqual(result.overflow, []);
});

test("addSerials reports overflow beyond the quantity to receive", () => {
  const result = addSerials([], ["S1", "S2", "S3"], 2);
  assert.deepEqual(result.serials, ["S1", "S2"]);
  assert.deepEqual(result.overflow, ["S3"]);
});

test("removeSerial, progress text and whole quantities", () => {
  assert.deepEqual(removeSerial(["A", "B"], "A"), ["B"]);
  assert.equal(formatSerialProgress(1, 1), "1 de 1 serie");
  assert.equal(formatSerialProgress(2, 5), "2 de 5 series");
  assert.equal(isWholeSerialQuantity(3), true);
  assert.equal(isWholeSerialQuantity(1.5), false);
});
