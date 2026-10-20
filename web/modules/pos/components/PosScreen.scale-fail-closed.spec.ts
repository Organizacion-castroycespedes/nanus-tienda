import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { getScaleCaptureOperatorMessage } from "../utils/scale-capture-error";

const source = readFileSync(resolve(process.cwd(), "modules/pos/components/PosScreen.tsx"), "utf8");
const cartSource = readFileSync(resolve(process.cwd(), "store/posCart.ts"), "utf8");
const cartModalSource = readFileSync(resolve(process.cwd(), "modules/pos/components/cart/CartSaleModal.tsx"), "utf8");

test("POS keeps UNIT sales and routes WEIGHT through a commercial capture", () => {
  assert.match(source, /const scaleCaptureControlsVisible = scaleUiVisible/);
  assert.match(source, /if \(saleType === "WEIGHT"\)/);
  assert.match(source, /addToCart\(product\)/);
  assert.match(source, /createPosWeightCapture\(product\.id\)/);
  assert.match(source, /accepted\.status !== "READY"/);
  assert.match(source, /accepted\.reading\.weight <= 0/);
  assert.match(source, /getScaleCaptureOperatorMessage\(error\)/);
  assert.match(source, /weightCapture: \{/);
  assert.doesNotMatch(source, /readCurrentWeight\s*\(/);
});

test("BOTH requires an explicit mode and weight never adds without authorization", () => {
  assert.match(source, /setBothSelectionProduct\(product\)/);
  assert.match(source, /onClick=\{selectBothUnit\}/);
  assert.match(source, /onClick=\{selectBothWeight\}/);
  assert.match(source, /La balanza no está disponible o autorizada para esta terminal/);
  assert.match(source, /createPosWeightCapture\(product\.id\)/);
  assert.match(source, /scaleControlsVisible=\{scaleCaptureControlsVisible\}/);
});

test("WEIGHT checkout sends only capture reference and local persistence strips it", () => {
  const start = source.indexOf('item.saleMode === "WEIGHT"');
  const end = source.indexOf("\n            : {", start);
  assert.ok(start >= 0 && end > start);
  const weightedPayload = source.slice(start, end);
  assert.match(weightedPayload, /saleMode: "WEIGHT"/);
  assert.match(weightedPayload, /weightCapture:/);
  assert.doesNotMatch(weightedPayload, /quantity:|price:|source:|weight:/);
  assert.match(cartSource, /items: stripCaptures\(state\.items\)/);
  assert.match(cartSource, /weightCapture: _weightCapture/);
});

test("pricing preview carries the selected cart sale mode and applies its returned quantity", () => {
  const refreshStart = source.indexOf("const refreshCartItemPricing = useCallback(");
  const refreshEnd = source.indexOf("const queueCartItemPricing = useCallback(", refreshStart);
  assert.ok(refreshStart >= 0 && refreshEnd > refreshStart);
  const refreshSource = source.slice(refreshStart, refreshEnd);
  assert.match(refreshSource, /saleMode: "UNIT" \| "WEIGHT"/);
  assert.match(refreshSource, /quantity,\s*saleMode,\s*channel: "POS"/);
  assert.match(source, /quantity: preview\.quantity/);
  assert.match(source, /queueCartItemPricing\(nextCart, product\.id, quantity, "WEIGHT"\)/);
  assert.match(source, /queueCartItemPricing\(\[\.\.\.currentCart, nextItem\], product\.id, quantity, "UNIT"\)/);
  assert.match(source, /item\.saleMode \?\? "UNIT"/);
  assert.match(cartModalSource, /item\.quantity\.toFixed\(3\)} kg/);
  assert.equal((0.245).toFixed(3), "0.245");
});

test("zero weight remains rejected before cart creation while a valid reading retains three decimals", () => {
  const handlerStart = source.indexOf("async function handleReadScaleForProduct");
  const cartStart = source.indexOf("const nextItem: PosCartItem", handlerStart);
  const handlerEnd = source.indexOf("const handleReadScaleFromCart", handlerStart);
  assert.ok(handlerStart >= 0 && cartStart > handlerStart);
  const validation = source.slice(handlerStart, cartStart);
  assert.match(validation, /accepted\.reading\.weight <= 0/);
  assert.match(validation, /accepted\.reading\.weight === 0[\s\S]*?SCALE_WEIGHT_ZERO/);
  assert.doesNotMatch(validation, /setCartItemsAndRef|queueCartItemPricing|addToCart\(/);
  assert.ok(handlerEnd > cartStart);
  assert.match(source.slice(cartStart, handlerEnd), /queueCartItemPricing\(nextCart, product\.id, quantity, "WEIGHT"\)/);
  assert.equal(getScaleCaptureOperatorMessage(new Error("SCALE_WEIGHT_ZERO")), undefined);
});
