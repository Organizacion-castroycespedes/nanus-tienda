import assert from "node:assert/strict";
import test from "node:test";
import {
  hasElectronTerminalBridge,
  isLocalQaLocation,
  isTerminalDiagnosticsShortcut,
} from "./diagnostics-access";

test("diagnostics access is limited to loopback QA locations", () => {
  assert.equal(isLocalQaLocation({ hostname: "localhost", port: "3000" }), true);
  assert.equal(isLocalQaLocation({ hostname: "127.0.0.1", port: "" }), true);
  assert.equal(isLocalQaLocation({ hostname: "portal.emaus.centrivosoft.com", port: "443" }), false);
});

test("diagnostics shortcut requires the Electron bridge", () => {
  assert.equal(hasElectronTerminalBridge({ getRuntimeInfo: async () => ({}) }), true);
  assert.equal(hasElectronTerminalBridge({}), false);
  assert.equal(hasElectronTerminalBridge(null), false);
});

test("diagnostics shortcut ignores editable fields and repeats", () => {
  const base = { key: "d", ctrlKey: true, altKey: true, shiftKey: true, repeat: false };
  assert.equal(isTerminalDiagnosticsShortcut({ ...base, target: null }), true);
  assert.equal(isTerminalDiagnosticsShortcut({ ...base, target: { tagName: "INPUT" } as HTMLElement }), false);
  assert.equal(isTerminalDiagnosticsShortcut({ ...base, repeat: true, target: null }), false);
});
