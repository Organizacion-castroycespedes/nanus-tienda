import assert from "node:assert/strict";
import test from "node:test";
import { buildTerminalDeviceBindingPayload } from "./terminal-devices.service";

test("admin binding payload uses the explicitly selected terminal", () => {
  const terminalOne = buildTerminalDeviceBindingPayload("terminal-1", "device-a");
  const terminalTwo = buildTerminalDeviceBindingPayload("terminal-2", "device-b");

  assert.deepEqual(terminalOne, { terminalId: "terminal-1", deviceId: "device-a" });
  assert.deepEqual(terminalTwo, { terminalId: "terminal-2", deviceId: "device-b" });
  assert.notEqual(terminalOne.terminalId, terminalTwo.terminalId);
});
