import assert from "node:assert/strict";
import test from "node:test";
import { TerminalReadinessOrchestrator } from "./orchestrator";

const setWindow = (manusTerminal: unknown) =>
  Object.defineProperty(globalThis, "window", { configurable: true, value: { manusTerminal } });
const info = { electronRuntimeVersion: "0.1.0", bridgeContractVersion: 1, agentApiVersion: 1, capabilities: ["agent.health"] };
const healthy = (id = "install-a") => ({
  getRuntimeInfo: async () => info,
  getAgentHealth: async () => ({ status: "ok", agentInstallationId: id, version: "1.0.0" }),
});
const cloud = async (payload: unknown, run: () => Promise<void>) => {
  const old = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  try { await run(); } finally { globalThis.fetch = old; }
};

test("WEB mode does not call Agent or cloud readiness", async () => {
  setWindow(undefined);
  let called = false;
  const old = globalThis.fetch;
  globalThis.fetch = async () => { called = true; throw new Error("must not call"); };
  try {
    const value = await new TerminalReadinessOrchestrator().evaluate({ authenticated: true });
    assert.deepEqual(
      [value.mode, value.resolution, value.agent.reachable, value.cloud.reachable, value.state, value.canEnterPos, value.reason],
      ["WEB", "NOT_RESOLVED", false, false, "READY", true, "READY"]
    );
    assert.equal(called, false);
  } finally { globalThis.fetch = old; }
});

test("Electron configured runtime reports cloud reachable", async () => {
  setWindow(healthy());
  await cloud({ resolution: "CONFIGURED", deviceStatus: "BOUND", terminal: { terminalId: "terminal-a", branchId: "branch-a", active: true } }, async () => {
    const value = await new TerminalReadinessOrchestrator().evaluate({ authenticated: true });
    assert.deepEqual([value.state, value.reason, value.canEnterPos, value.cloud.reachable], ["READY", "READY", true, true]);
  });
});

test("Electron terminal mismatch blocks without changing context", async () => {
  setWindow(healthy());
  await cloud({ resolution: "CONFIGURED", deviceStatus: "BOUND", terminal: { terminalId: "terminal-a", branchId: "branch-a", active: true } }, async () => {
    const value = await new TerminalReadinessOrchestrator().evaluate({ authenticated: true, posTerminalId: "terminal-b" });
    assert.deepEqual([value.state, value.reason, value.canEnterPos], ["NOT_CONFIGURED", "TERMINAL_CONTEXT_MISMATCH", false]);
  });
});

test("cloud failure then retry recovers", async () => {
  setWindow(healthy());
  const old = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("cloud down");
    return new Response(JSON.stringify({ resolution: "CONFIGURED", deviceStatus: "BOUND", terminal: { terminalId: "terminal-a", branchId: "branch-a", active: true } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const runtime = new TerminalReadinessOrchestrator();
    assert.equal((await runtime.evaluate({ authenticated: true })).state, "CLOUD_UNAVAILABLE");
    assert.equal((await runtime.refresh({ authenticated: true })).state, "READY");
    assert.equal(attempts, 2);
  } finally { globalThis.fetch = old; }
});
