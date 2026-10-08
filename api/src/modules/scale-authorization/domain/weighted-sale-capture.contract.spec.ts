import assert from "node:assert/strict";
import test from "node:test";
import { parseWeightedSaleCaptureReference, saleModeRequiresWeightCapture } from "./weighted-sale-capture.contract";

test("weighted sale accepts capture reference only and rejects client weight authority", () => {
  assert.deepEqual(parseWeightedSaleCaptureReference({ captureId: "c1", nonce: "n1" }), { captureId: "c1", nonce: "n1" });
  assert.throws(() => parseWeightedSaleCaptureReference({ captureId: "c1", nonce: "n1", weight: 0.245 }), /CLIENT_WEIGHT_AUTHORITY_FORBIDDEN/);
  assert.throws(() => parseWeightedSaleCaptureReference({ captureId: "c1", nonce: "n1", source: "MOCK" }), /CLIENT_WEIGHT_AUTHORITY_FORBIDDEN/);
  assert.equal(saleModeRequiresWeightCapture("UNIT", "UNIT"), false);
  assert.equal(saleModeRequiresWeightCapture("BOTH", "UNIT"), false);
  assert.equal(saleModeRequiresWeightCapture("BOTH", "WEIGHT"), true);
});
