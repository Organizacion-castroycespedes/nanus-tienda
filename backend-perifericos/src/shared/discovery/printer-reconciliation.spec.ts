import assert from "node:assert/strict";
import test from "node:test";
import { reconcilePrinters } from "./printer-reconciliation";

test("reconciles PnP-only and queue-only without false connected", () => {
  const result = reconcilePrinters([{ name: "USB Printer", nativeIdentifier: "USB\\A" }], [{ name: "XP-80", portName: "USB001" }]);
  assert.equal(result[0].physicalDetected, true); assert.equal(result[0].queueInstalled, false);
  assert.equal(result[1].physicalDetected, false); assert.equal(result[1].status, "OFFLINE"); assert.equal(result[1].windowsQueueName, "XP-80");
});
test("merges only exact native identity", () => {
  const result = reconcilePrinters([{ name: "USB Printer", nativeIdentifier: "USB\\A" }], [{ name: "XP-80", portName: "USB001", nativeIdentifier: "USB\\A" }]);
  assert.equal(result.length, 1); assert.equal(result[0].status, "CONNECTED");
});
test("keeps ambiguous same model devices separate", () => {
  const result = reconcilePrinters([{ name: "USB Printer", nativeIdentifier: "USB\\A" }, { name: "USB Printer", nativeIdentifier: "USB\\B" }], [{ name: "USB Printer", portName: "USB001" }]);
  assert.equal(result.length, 3);
});

test("honors an explicit physical-device to differently named Windows queue binding", () => {
  const result = reconcilePrinters(
    [{ name: "Printer POS-80", deviceId: "usb-printer-804a1994045911fd", nativeIdentifier: "USB\\VID_1FC9&PID_2016\\5D2F0E663532" }],
    [{ name: "XP-80", portName: "USB001" }],
    [{ physicalDeviceId: "usb-printer-804a1994045911fd", queueName: "XP-80" }],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].nativeIdentifier, "USB\\VID_1FC9&PID_2016\\5D2F0E663532");
  assert.equal(result[0].windowsQueueName, "XP-80");
  assert.equal(result[0].queueInstalled, true);
  assert.equal(result[0].status, "CONNECTED");
});

test("does not auto-bind without an explicit association", () => {
  const result = reconcilePrinters(
    [{ name: "Printer POS-80", nativeIdentifier: "USB\\VID_1FC9&PID_2016\\5D2F0E663532" }],
    [{ name: "XP-80", portName: "USB001" }],
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].queueInstalled, false);
  assert.equal(result[1].physicalDetected, false);
});

test("fails closed when the explicitly selected queue is missing or ambiguous", () => {
  const physical = [{ name: "Printer POS-80", nativeIdentifier: "USB\\P" }];
  const binding = [{ physicalNativeIdentifier: "USB\\P", queueName: "XP-80" }];
  const missing = reconcilePrinters(physical, [{ name: "XP-58", portName: "USB002" }], binding);
  assert.equal(missing[0].queueInstalled, false);
  const offline = reconcilePrinters(physical, [{ name: "XP-80", portName: "USB001", ready: false }], binding);
  assert.equal(offline[0].queueInstalled, false);
  const ambiguous = reconcilePrinters(physical, [{ name: "XP-80", portName: "USB001" }, { name: "XP-80", portName: "USB001" }], binding);
  assert.equal(ambiguous[0].queueInstalled, false);
  assert.equal(ambiguous.length, 3);
});

test("keeps exact native-identifier reconciliation behavior", () => {
  const result = reconcilePrinters(
    [{ name: "USB Printer", nativeIdentifier: "USB\\A" }],
    [{ name: "XP-80", portName: "USB001", nativeIdentifier: "USB\\A" }],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].queueInstalled, true);
  assert.equal(result[0].status, "CONNECTED");
});
