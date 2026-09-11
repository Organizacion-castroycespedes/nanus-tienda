import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildRuntimeInfo, IPC_CHANNELS, RUNTIME_CAPABILITIES, type ManusTerminalApi, type RuntimeInfo } from "./electron-api.js";

test("runtime metadata reports shell package version and supported contracts", () => {
  const info: Awaited<ReturnType<ManusTerminalApi["getRuntimeInfo"]>> = buildRuntimeInfo("0.1.0", { available: true, agentApiVersion: 1 });
  assert.deepEqual(info, { electronRuntimeVersion: "0.1.0", bridgeContractVersion: 1, agentApiVersion: 1, capabilities: [...RUNTIME_CAPABILITIES] });
  assert.equal(new Set(info.capabilities).size, info.capabilities.length);
});

test("unknown, unavailable and unsupported Agent do not advertise hardware operations", () => {
  for (const health of [{ available: false }, { available: true }, { available: true, agentApiVersion: 2 }]) {
    const info: RuntimeInfo = buildRuntimeInfo("0.1.0", health);
    assert.deepEqual(info.capabilities, ["agent.health"]);
    assert.equal(info.agentApiVersion, health.agentApiVersion ?? null);
  }
});

test("metadata uses one fixed preload channel and preserves isolation", () => {
  const preload = readFileSync("preload.ts", "utf8");
  const main = readFileSync("main.ts", "utf8");
  assert.equal(IPC_CHANNELS.getRuntimeInfo, "manusTerminal.getRuntimeInfo");
  assert.match(preload, /getRuntimeInfo: \(\) => ipcRenderer.invoke\(IPC_CHANNELS.getRuntimeInfo\)/);
  for (const setting of ["contextIsolation: true", "nodeIntegration: false", "sandbox: true"]) assert.ok(main.includes(setting));
});
