import assert from "node:assert/strict";
import test from "node:test";
import {
  capturePosScannerWedgeChar,
  createPosScannerWedgeState,
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
