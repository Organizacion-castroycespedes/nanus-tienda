import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createInventoryBarcodeWedgeState,
  handleInventoryBarcodeKey,
  isInventoryBarcodeTerminatorKey,
  type InventoryBarcodeWedgeState,
} from "./barcode-wedge";

const typeSequence = (keys: string[], gapMs: number, startMs = 0) => {
  let state: InventoryBarcodeWedgeState = createInventoryBarcodeWedgeState();
  let time = startMs;
  for (const key of keys) {
    state = handleInventoryBarcodeKey(state, key, time).nextState;
    time += gapMs;
  }
  return { state, time };
};

describe("inventory barcode wedge", () => {
  it("commits a fast sequence of at least 8 characters ended by Enter", () => {
    const { state, time } = typeSequence("7701234567890".split(""), 15);
    const result = handleInventoryBarcodeKey(state, "Enter", time);
    assert.equal(result.committedCode, "7701234567890");
    assert.equal(result.isTerminator, true);
    assert.equal(result.nextState.buffer, "");
  });

  it("does not commit human typing", () => {
    const { state, time } = typeSequence("7701234567890".split(""), 180);
    const result = handleInventoryBarcodeKey(state, "Enter", time);
    assert.equal(result.committedCode, null);
    assert.equal(result.isTerminator, true);
  });

  it("does not commit codes shorter than the minimum length", () => {
    const { state, time } = typeSequence("1234567".split(""), 10);
    assert.equal(handleInventoryBarcodeKey(state, "Enter", time).committedCode, null);
  });

  it("does not commit when the terminator arrives late", () => {
    const { state, time } = typeSequence("7701234567890".split(""), 10);
    assert.equal(handleInventoryBarcodeKey(state, "Enter", time + 400).committedCode, null);
  });

  it("restarts the buffer after a long pause", () => {
    const first = typeSequence("abc".split(""), 10);
    let state = first.state;
    let clock = first.time + 500;
    for (const key of "12345678".split("")) {
      state = handleInventoryBarcodeKey(state, key, clock).nextState;
      clock += 10;
    }
    assert.equal(state.buffer, "12345678");
    assert.equal(handleInventoryBarcodeKey(state, "Enter", clock).committedCode, "12345678");
  });

  it("ignores non printable keys", () => {
    const state = createInventoryBarcodeWedgeState();
    const result = handleInventoryBarcodeKey(state, "Shift", 0);
    assert.equal(result.nextState, state);
    assert.equal(result.committedCode, null);
  });

  it("recognizes scanner terminators", () => {
    for (const key of ["Enter", "Return", "\r", "\n", "LF"]) {
      assert.equal(isInventoryBarcodeTerminatorKey(key), true);
    }
    assert.equal(isInventoryBarcodeTerminatorKey("Tab"), false);
  });
});
