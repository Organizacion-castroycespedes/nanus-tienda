import assert from "node:assert/strict";
import test from "node:test";
import { armScanner, receiveScannerKey, timeoutScanner } from "./scanner-capture";

test("keyboard wedge completes only while armed", () => {
  let capture = armScanner();
  capture = receiveScannerKey(capture, "1");
  capture = receiveScannerKey(capture, "2");
  capture = receiveScannerKey(capture, "Enter");
  assert.equal(capture.state, "COMPLETE"); assert.equal(capture.value, "12");
});
test("inactive capture ignores keys and timeout resets", () => {
  const idle = { state: "IDLE" as const, value: "", maxLength: 4 };
  assert.deepEqual(receiveScannerKey(idle, "1"), idle);
  const timed = timeoutScanner(receiveScannerKey(armScanner(4), "1"));
  assert.equal(timed.state, "TIMEOUT"); assert.equal(timed.value, "");
});
test("capture is bounded", () => {
  let capture = armScanner(1); capture = receiveScannerKey(capture, "1"); capture = receiveScannerKey(capture, "2");
  assert.equal(capture.state, "ERROR");
});
