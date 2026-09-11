import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeInfo as ElectronRuntimeInfo } from "../../../desktop/electron/electron-api";
import { CAPABILITY_METHODS, getTerminalRuntime, hasRuntimeCapability, type RuntimeInfo } from "./runtime-contract";
import { requestPeripheral, PeripheralAgentRequestError } from "./api";

const info: RuntimeInfo = { electronRuntimeVersion: "0.1.0", bridgeContractVersion: 1, agentApiVersion: 1, capabilities: Object.keys(CAPABILITY_METHODS) as RuntimeInfo["capabilities"] };
// Both independently built applications must agree on the complete wire shape.
const electronInfo: ElectronRuntimeInfo = info;
const webInfo: RuntimeInfo = electronInfo;
const bridge = () => ({ ...Object.fromEntries(Object.values(CAPABILITY_METHODS).map((method) => [method, async () => "ok"])), getRuntimeInfo: async (): Promise<RuntimeInfo> => webInfo });

test("generation 1 contracts and callable capabilities are compatible", async () => {
  const runtime = await getTerminalRuntime(bridge());
  assert.equal(runtime.state, "COMPATIBLE");
  assert.equal(hasRuntimeCapability(runtime, "printer.printTicket"), true);
});

test("browser/SSR and old partial bridges are safe", async () => {
  assert.equal((await getTerminalRuntime(null)).reason, "NO_BRIDGE");
  const runtime = await getTerminalRuntime({ printTicket: async () => "ok" });
  assert.equal(runtime.state, "DEGRADED");
  assert.equal(runtime.reason, "LEGACY_BRIDGE");
  assert.equal(hasRuntimeCapability(runtime, "printer.printTicket"), true);
  assert.equal(hasRuntimeCapability(runtime, "drawer.open"), false);
});

test("missing methods and declarations degrade and unknown additive capabilities are ignored", async () => {
  const partial = bridge();
  delete partial.printTicket;
  assert.equal(hasRuntimeCapability(await getTerminalRuntime(partial), "printer.printTicket"), false);
  const minimal = { getRuntimeInfo: async () => ({ ...info, capabilities: ["agent.health", "future.operation"] }), getAgentHealth: async () => "ok" };
  assert.equal((await getTerminalRuntime(minimal)).state, "DEGRADED");
  assert.equal((await getTerminalRuntime(minimal, ["agent.health"])).state, "COMPATIBLE");
});

test("unsupported and malformed metadata fail closed", async () => {
  for (const raw of [null, {}, { ...info, bridgeContractVersion: 2 }, { ...info, agentApiVersion: 2 }, { ...info, bridgeContractVersion: 1.5 }, { ...info, capabilities: [1] }]) {
    const runtime = await getTerminalRuntime({ ...bridge(), getRuntimeInfo: async () => raw });
    assert.equal(runtime.state, "INCOMPATIBLE");
    assert.deepEqual(runtime.capabilities, []);
  }
  const unknown = await getTerminalRuntime({ ...bridge(), getRuntimeInfo: async () => ({ ...info, agentApiVersion: null }) });
  assert.equal(unknown.reason, "AGENT_UNKNOWN");
  assert.deepEqual(unknown.capabilities, ["agent.health"]);
});

test("rejected and hanging modern metadata do not enable legacy calls", async () => {
  for (const getRuntimeInfo of [async () => { throw new Error("unavailable"); }, () => new Promise(() => {})]) {
    const runtime = await getTerminalRuntime({ ...bridge(), getRuntimeInfo }, undefined, 5);
    assert.equal(runtime.reason, "METADATA_UNAVAILABLE");
    assert.deepEqual(runtime.capabilities, []);
  }
});

test("fixed transport blocks absent capability without native call or browser fallback", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { throw new Error("unexpected browser fallback"); };
  try {
    for (const manusTerminal of [{}, { printTicket: undefined }, { getRuntimeInfo: async () => ({ ...info, capabilities: [] }), printTicket: async () => { calls++; } }]) {
      Object.defineProperty(globalThis, "window", { configurable: true, value: { manusTerminal } });
      await assert.rejects(requestPeripheral("/printer/print-ticket", { method: "POST", body: "{}" }), (error: unknown) => error instanceof PeripheralAgentRequestError && error.code === "OPERATION_DISABLED");
    }
    Object.defineProperty(globalThis, "window", { configurable: true, value: { manusTerminal: { printTicket: async () => "legacy" } } });
    assert.equal(await requestPeripheral("/printer/print-ticket", { method: "POST", body: "{}" }), "legacy");
    Object.defineProperty(globalThis, "window", { configurable: true, value: { manusTerminal: bridge() } });
    assert.equal(await requestPeripheral("/printer/print-ticket", { method: "POST", body: "{}" }), "ok");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
