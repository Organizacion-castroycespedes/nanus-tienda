import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(process.cwd(), "modules/pos/components/PosScreen.tsx"), "utf8");

test("POS keeps UNIT sales available while WEIGHT capture is fail-closed", () => {
  assert.match(source, /const scaleCaptureControlsVisible = false/);
  assert.match(source, /if \(saleType === "WEIGHT"\)/);
  assert.match(source, /addToCart\(product\)/);
  assert.doesNotMatch(source, /readCurrentWeight\s*\(/);
});

test("BOTH requires an explicit mode and weight never adds without authorization", () => {
  assert.match(source, /setBothSelectionProduct\(product\)/);
  assert.match(source, /onClick=\{selectBothUnit\}/);
  assert.match(source, /onClick=\{selectBothWeight\}/);
  assert.match(source, /La lectura REAL de balanza aún no está disponible/);
  assert.match(source, /scaleControlsVisible=\{scaleCaptureControlsVisible\}/);
});
