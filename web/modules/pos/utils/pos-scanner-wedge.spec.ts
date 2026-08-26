import assert from "node:assert/strict";
import test from "node:test";
import {
  capturePosScannerWedgeChar,
  createPosScannerWedgeState,
  handlePosScannerKeyboardEvent,
  isPosScannerTerminatorKey,
  shouldCommitPosScannerWedge,
} from "./pos-scanner-wedge";

test("scanner wedge accepts a fast barcode sequence", () => {
  let state = createPosScannerWedgeState();
  state = capturePosScannerWedgeChar(state, "7", 0);
  state = capturePosScannerWedgeChar(state, "7", 18);
  state = capturePosScannerWedgeChar(state, "0", 33);
  state = capturePosScannerWedgeChar(state, "1", 47);
  state = capturePosScannerWedgeChar(state, "2", 61);
  state = capturePosScannerWedgeChar(state, "3", 76);
  state = capturePosScannerWedgeChar(state, "4", 91);
  state = capturePosScannerWedgeChar(state, "5", 107);

  assert.equal(shouldCommitPosScannerWedge(state, 115), true);
  assert.equal(state.buffer, "77012345");
});

test("scanner wedge rejects slow human typing", () => {
  let state = createPosScannerWedgeState();
  state = capturePosScannerWedgeChar(state, "7", 0);
  state = capturePosScannerWedgeChar(state, "7", 260);
  state = capturePosScannerWedgeChar(state, "0", 540);
  state = capturePosScannerWedgeChar(state, "1", 810);
  state = capturePosScannerWedgeChar(state, "2", 1080);
  state = capturePosScannerWedgeChar(state, "3", 1340);
  state = capturePosScannerWedgeChar(state, "4", 1590);
  state = capturePosScannerWedgeChar(state, "5", 1860);

  assert.equal(shouldCommitPosScannerWedge(state, 1920), false);
});

test("scanner wedge resets after a long gap", () => {
  let state = createPosScannerWedgeState();
  state = capturePosScannerWedgeChar(state, "7", 0);
  state = capturePosScannerWedgeChar(state, "7", 10);
  state = capturePosScannerWedgeChar(state, "0", 20);
  state = capturePosScannerWedgeChar(state, "1", 90);

  assert.equal(state.buffer, "1");
  assert.equal(shouldCommitPosScannerWedge(state, 120), false);
});

test("scanner terminators include Enter CR and LF", () => {
  assert.equal(isPosScannerTerminatorKey("Enter"), true);
  assert.equal(isPosScannerTerminatorKey("CR"), true);
  assert.equal(isPosScannerTerminatorKey("LF"), true);
  assert.equal(isPosScannerTerminatorKey("LineFeed"), true);
  assert.equal(isPosScannerTerminatorKey("A"), false);
});

test("scanner wedge commits on Enter and resets after commit", () => {
  let state = createPosScannerWedgeState();
  const code = "77012345";
  for (const [index, key] of Array.from(code).entries()) {
    state = capturePosScannerWedgeChar(state, key, index * 12);
  }

  const result = handlePosScannerKeyboardEvent(
    state,
    "Enter",
    110,
    true
  );

  assert.equal(result.committedCode, code);
  assert.equal(result.nextState.buffer, "");
});

test("scanner wedge commits on CR and LF", () => {
  let state = createPosScannerWedgeState();
  const code = "77012345";
  for (const [index, key] of Array.from(code).entries()) {
    state = capturePosScannerWedgeChar(state, key, index * 10);
  }

  const crResult = handlePosScannerKeyboardEvent(state, "CR", 105, true);
  assert.equal(crResult.committedCode, code);

  let nextState = createPosScannerWedgeState();
  for (const [index, key] of Array.from(code).entries()) {
    nextState = capturePosScannerWedgeChar(nextState, key, index * 11);
  }

  const lfResult = handlePosScannerKeyboardEvent(nextState, "LF", 108, true);
  assert.equal(lfResult.committedCode, code);
});

test("scanner wedge supports repeated scans", () => {
  let state = createPosScannerWedgeState();
  const first = "77012345";
  const second = "88098765";

  for (const [index, key] of Array.from(first).entries()) {
    state = capturePosScannerWedgeChar(state, key, index * 8);
  }
  const firstResult = handlePosScannerKeyboardEvent(state, "Enter", 100, true);

  state = firstResult.nextState;
  for (const [index, key] of Array.from(second).entries()) {
    state = capturePosScannerWedgeChar(state, key, 200 + index * 8);
  }
  const secondResult = handlePosScannerKeyboardEvent(
    state,
    "Enter",
    300,
    true
  );

  assert.equal(firstResult.committedCode, first);
  assert.equal(secondResult.committedCode, second);
});

test("scanner wedge ignores input when disabled", () => {
  let state = createPosScannerWedgeState();
  state = capturePosScannerWedgeChar(state, "7", 0);
  state = capturePosScannerWedgeChar(state, "7", 10);

  const result = handlePosScannerKeyboardEvent(state, "Enter", 20, false);

  assert.equal(result.committedCode, null);
  assert.equal(result.nextState.buffer, "77");
});

test("scanner wedge ignores normal input keys", () => {
  const state = createPosScannerWedgeState();

  const result = handlePosScannerKeyboardEvent(state, "Backspace", 5, true);

  assert.equal(result.committedCode, null);
  assert.equal(result.nextState.buffer, "");
});
