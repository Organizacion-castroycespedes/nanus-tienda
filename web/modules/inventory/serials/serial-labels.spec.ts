import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedInspectionResults,
  canMoveSerial,
  serialEventLabel,
  serialReferenceLabel,
  serialStatusLabel,
} from "./serial-labels";

test("allowedInspectionResults sigue las transiciones de la función de inspección", () => {
  assert.deepEqual(allowedInspectionResults("RETURNED"), ["AVAILABLE", "BLOCKED", "WRITTEN_OFF"]);
  assert.deepEqual(allowedInspectionResults("BLOCKED"), ["AVAILABLE", "WRITTEN_OFF"]);
  assert.deepEqual(allowedInspectionResults("AVAILABLE"), ["BLOCKED"]);
  assert.deepEqual(allowedInspectionResults("SOLD"), []);
  assert.deepEqual(allowedInspectionResults("WRITTEN_OFF"), []);
});

test("canMoveSerial solo para series en existencia y etiquetas en español", () => {
  assert.equal(canMoveSerial("AVAILABLE"), true);
  assert.equal(canMoveSerial("SOLD"), false);
  assert.equal(serialStatusLabel("RETURNED"), "Devuelta (por inspeccionar)");
  assert.equal(serialEventLabel("DELIVERED"), "Entregada en pedido");
  assert.equal(serialEventLabel("OTRO"), "OTRO");
  assert.equal(serialReferenceLabel("SALE_VOID"), "Anulación de venta");
  assert.equal(serialReferenceLabel(null), "");
});
