import assert from "node:assert/strict";
import test from "node:test";
import { TerminalRuntimeService } from "./terminal-runtime.service";

const actor = { tenantId: "tenant-a" };
const record = (overrides: Record<string, unknown> = {}) => ({
  registration_status: "REGISTERED" as const,
  binding_terminal_id: null,
  terminal_id: null,
  branch_id: null,
  terminal_is_active: null,
  ...overrides,
});
const service = (value: unknown) =>
  new TerminalRuntimeService({
    findRuntimeResolution: async () => value,
  } as never);

test("runtime resolution requires authenticated tenant context", async () => {
  await assert.rejects(
    () => service(null).resolve({ installationId: "install-a" }, {}),
    /Tenant requerido/,
  );
});

test("runtime resolution returns configured terminal", async () => {
  const result = await service(
    record({
      registration_status: "BOUND",
      binding_terminal_id: "terminal-a",
      terminal_id: "terminal-a",
      branch_id: "branch-a",
      terminal_is_active: true,
    }),
  ).resolve({ installationId: "install-a" }, actor);
  assert.deepEqual(result, {
    resolution: "CONFIGURED",
    deviceStatus: "BOUND",
    terminal: { terminalId: "terminal-a", branchId: "branch-a", active: true },
  });
});

test("runtime resolution bounds unknown, unbound and revoked devices", async () => {
  assert.deepEqual(await service(null).resolve({ installationId: "x" }, actor), { resolution: "DEVICE_UNKNOWN" });
  assert.deepEqual(await service(record({ registration_status: "REVOKED" })).resolve({ installationId: "x" }, actor), { resolution: "DEVICE_REVOKED" });
  assert.deepEqual(await service(record()).resolve({ installationId: "x" }, actor), { resolution: "DEVICE_UNBOUND" });
});

test("runtime resolution bounds missing and inactive terminals", async () => {
  assert.deepEqual(await service(record({ binding_terminal_id: "terminal-a" })).resolve({ installationId: "x" }, actor), { resolution: "TERMINAL_UNKNOWN" });
  assert.deepEqual(await service(record({ binding_terminal_id: "terminal-a", terminal_id: "terminal-a", branch_id: "branch-a", terminal_is_active: false })).resolve({ installationId: "x" }, actor), { resolution: "TERMINAL_DISABLED" });
});

test("runtime resolution is read-only and ignores tenant payload overrides", async () => {
  const calls: unknown[][] = [];
  const runtime = new TerminalRuntimeService({
    findRuntimeResolution: async (...args: unknown[]) => { calls.push(args); return null; },
  } as never);
  const result = await runtime.resolve({ installationId: "install-a", tenantId: "tenant-b" } as never, actor);
  assert.deepEqual(result, { resolution: "DEVICE_UNKNOWN" });
  assert.deepEqual(calls, [["install-a", "tenant-a"]]);
});
