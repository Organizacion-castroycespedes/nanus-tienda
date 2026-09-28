import test from "node:test";
import assert from "node:assert/strict";
import { OperationalControlService } from "./operational-control.service";

const actor = { id: "11111111-1111-4111-8111-111111111111", tenantId: "00000000-0000-0000-0000-000000000001", branchId: null, roles: ["USER"] };
const branchScope = { resolve: async () => ({ tenantId: actor.tenantId, branchIds: [] }) };

test("operational control rejects malformed scope ids before database call", async () => {
  let called = false;
  const service = new OperationalControlService({ executeFunction: async () => { called = true; return {}; } } as never, branchScope as never);
  await assert.rejects(() => service.getSnapshot({ period: "TODAY", tenantId: "bad" }, actor), /tenantId must be a UUID/);
  assert.equal(called, false);
});

test("operational control passes actor role and bounded period to the stored function", async () => {
  let args: unknown[] = [];
  const service = new OperationalControlService({ executeFunction: async (_name: string, params: unknown[]) => { args = params; return { metrics: {}, charts: {} }; } } as never, branchScope as never);
  const result = await service.getSnapshot({ period: "LAST_7_DAYS" }, actor);
  assert.equal(args[0], actor.id);
  assert.equal(args[1], "USER");
  assert.equal(args[2], actor.tenantId);
  assert.equal(args[10], "day");
  assert.equal(result.meta.period, "LAST_7_DAYS");
  assert.equal(result.meta.timezone, "America/Bogota");
});

test("operational control accepts repository fixture UUIDs", async () => {
  let called = false;
  const service = new OperationalControlService({ executeFunction: async () => { called = true; return {}; } } as never, branchScope as never);
  await service.getSnapshot({ period: "LAST_7_DAYS", tenantId: "00000000-0000-0000-0000-000000000001" }, actor);
  assert.equal(called, true);
});

test("operational control rejects unsupported periods", async () => {
  const service = new OperationalControlService({ executeFunction: async () => ({}) } as never, branchScope as never);
  await assert.rejects(() => service.getSnapshot({ period: "YESTERDAY" as never }, actor), /Unsupported period/);
});

test("operational control forwards terminal and cashier intersections", async () => {
  let args: unknown[] = [];
  const service = new OperationalControlService({ executeFunction: async (_name: string, params: unknown[]) => { args = params; return {}; } } as never, branchScope as never);
  const admin = { ...actor, branchId: "55555555-5555-4555-8555-555555555555", roles: ["ADMIN"] };
  await service.getSnapshot({ period: "TODAY", terminalId: "33333333-3333-4333-8333-333333333333", cashierId: "44444444-4444-4444-8444-444444444444" }, admin);
  assert.equal(args[6], "33333333-3333-4333-8333-333333333333");
  assert.equal(args[7], "44444444-4444-4444-8444-444444444444");
  assert.equal(args[10], "hour");
});

test("operational control rejects a USER cashier expansion before database call", async () => {
  let called = false;
  const service = new OperationalControlService({ executeFunction: async () => { called = true; return {}; } } as never, branchScope as never);
  await assert.rejects(() => service.getSnapshot({ period: "TODAY", cashierId: "44444444-4444-4444-8444-444444444444" }, actor), /Cashier filter is outside actor scope/);
  assert.equal(called, false);
});

test("ADMIN uses the authorized branch relation when JWT branch_id is absent", async () => {
  let args: unknown[] = [];
  const service = new OperationalControlService(
    { executeFunction: async (_name: string, params: unknown[]) => { args = params; return {}; } } as never,
    { resolve: async () => ({ tenantId: actor.tenantId, branchIds: ["ab41d3da-6686-4de3-9191-875a5a7da5a5"] }) } as never,
  );
  await service.getSnapshot(
    { period: "TODAY", tenantId: actor.tenantId, branchId: "ab41d3da-6686-4de3-9191-875a5a7da5a5" },
    { ...actor, roles: ["ADMIN"] },
  );
  assert.equal(args[3], "ab41d3da-6686-4de3-9191-875a5a7da5a5");
  assert.equal(args[5], "ab41d3da-6686-4de3-9191-875a5a7da5a5");
});
