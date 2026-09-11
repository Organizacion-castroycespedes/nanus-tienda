import assert from "node:assert/strict";
import test from "node:test";
import { reconcilePrinters } from "./printer-reconciliation";

test("reconciles PnP-only and queue-only without false connected", () => {
  const result = reconcilePrinters([{ name: "USB Printer", nativeIdentifier: "USB\\A" }], [{ name: "XP-80", portName: "USB001" }]);
  assert.equal(result[0].physicalDetected, true); assert.equal(result[0].queueInstalled, false);
  assert.equal(result[1].physicalDetected, false); assert.equal(result[1].status, "OFFLINE"); assert.equal(result[1].windowsQueueName, "Queue Printer");
});
test("merges only exact native identity", () => {
  const result = reconcilePrinters([{ name: "USB Printer", nativeIdentifier: "USB\\A" }], [{ name: "XP-80", portName: "USB001", nativeIdentifier: "USB\\A" }]);
  assert.equal(result.length, 1); assert.equal(result[0].status, "CONNECTED");
});
test("keeps ambiguous same model devices separate", () => {
  const result = reconcilePrinters([{ name: "USB Printer", nativeIdentifier: "USB\\A" }, { name: "USB Printer", nativeIdentifier: "USB\\B" }], [{ name: "USB Printer", portName: "USB001" }]);
  assert.equal(result.length, 3);
});
