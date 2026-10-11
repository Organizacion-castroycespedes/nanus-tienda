import assert from "node:assert/strict";
import test from "node:test";
import { consumeWeightCapture, createWeightCapture, markCaptureReady, type WeightCaptureContext } from "./weight-capture.domain";

const context: WeightCaptureContext = { tenantId: "t", branchId: "b", posTerminalId: "p", operationalTerminalId: "o", posSessionId: "s", productId: "prod", logicalScaleId: "scale", bindingId: "bind" };
const now = new Date("2026-01-01T00:00:00Z");

test("one-time capture is REAL/kg/context-bound and can transition to consumed", () => {
  const created = createWeightCapture(context, 30_000, now);
  const ready = markCaptureReady(created.capture, { source: "REAL", value: 0.245, unit: "kg", unitVerified: true, observedAt: now.toISOString() }, now);
  assert.equal(ready.status, "READY");
  const consumed = consumeWeightCapture(ready, created.nonce, context, now);
  assert.equal(consumed.weightKg, 0.245);
  assert.equal(consumed.capture.status, "CONSUMED");
  assert.throws(() => consumeWeightCapture(consumed.capture, created.nonce, context, now), /CAPTURE_NOT_READY/);
  for (const key of Object.keys(context) as Array<keyof WeightCaptureContext>) {
    assert.throws(() => consumeWeightCapture(ready, created.nonce, { ...context, [key]: "other" }, now), /CAPTURE_CONTEXT_MISMATCH/);
  }
  assert.throws(() => consumeWeightCapture(ready, "wrong-nonce", context, now), /CAPTURE_NONCE_INVALID/);
});

test("capture expires and rejects MOCK, non-kg and unverified units", () => {
  const created = createWeightCapture(context, 10, now);
  assert.equal(markCaptureReady(created.capture, { source: "REAL", value: 1, unit: "kg", unitVerified: true, observedAt: now.toISOString() }, new Date(now.getTime() + 10)).status, "EXPIRED");
  assert.equal(markCaptureReady(created.capture, { source: "MOCK", value: 1, unit: "kg", unitVerified: true, observedAt: now.toISOString() }, now).status, "REJECTED");
  assert.equal(markCaptureReady(created.capture, { source: "REAL", value: 1, unit: "lb", unitVerified: true, observedAt: now.toISOString() }, now).status, "REJECTED");
  assert.equal(markCaptureReady(created.capture, { source: "REAL", value: 1, unit: "kg", unitVerified: false, observedAt: now.toISOString() }, now).status, "REJECTED");
  assert.throws(() => consumeWeightCapture(created.capture, "wrong", context, now), /CAPTURE_NOT_READY/);
});
