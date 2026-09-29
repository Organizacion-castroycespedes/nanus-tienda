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

test("operational control sends valid Bogota ISO boundaries for every period", async () => {
  const fixedNow = new Date("2026-09-27T18:30:12.123Z");
  const expectedDays = { TODAY: 1, LAST_7_DAYS: 7, LAST_30_DAYS: 30 } as const;

  for (const [period, days] of Object.entries(expectedDays)) {
    let args: unknown[] = [];
    const service = new OperationalControlService({
      executeFunction: async (_name: string, params: unknown[]) => { args = params; return {}; },
    } as never, branchScope as never);
    const datesMethod = (service as unknown as {
      dates: (value: string, now?: Date) => { from: Date; to: Date };
    }).dates;
    const dates = datesMethod.call(service, period, fixedNow);
    (service as unknown as { dates: () => { from: Date; to: Date; bucket: string } }).dates = () => ({
      ...dates,
      bucket: period === "TODAY" ? "hour" : "day",
    });
    await service.getSnapshot({ period: period as "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" }, actor);

    const from = args[8];
    const to = args[9];
    assert.equal(typeof from, "string");
    assert.equal(typeof to, "string");
    assert.doesNotThrow(() => new Date(from as string).toISOString());
    assert.doesNotThrow(() => new Date(to as string).toISOString());
    assert.match(from as string, /Z$/);
    assert.match(to as string, /Z$/);
    assert.equal(new Date(to as string).getTime() - new Date(from as string).getTime(), days * 86400000);
    assert.equal(from, new Date(Date.parse("2026-09-27T05:00:00.000Z") - (days - 1) * 86400000).toISOString());
    assert.equal(to, "2026-09-28T05:00:00.000Z");
    assert.equal(dates.to.getTime() - dates.from.getTime(), days * 86400000);
  }
});

test("operational control ignores a localized formatter string and uses date parts", async () => {
  const fixedNow = new Date("2026-09-27T18:30:12.123Z");
  const OriginalDate = globalThis.Date;
  const formatDescriptor = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "format");
  const formatToPartsDescriptor = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "formatToParts");
  let args: unknown[] = [];
  const service = new OperationalControlService({
    executeFunction: async (_name: string, params: unknown[]) => { args = params; return {}; },
  } as never, branchScope as never);

  class FixedDate extends OriginalDate {
    constructor(value?: string | number | Date) {
      if (value === undefined) super(fixedNow.getTime());
      else if (value instanceof OriginalDate) super(value.getTime());
      else super(value);
    }

    static now() { return fixedNow.getTime(); }
  }

  Object.defineProperty(Intl.DateTimeFormat.prototype, "format", {
    configurable: true,
    value: () => "09/27/2026",
  });
  Object.defineProperty(Intl.DateTimeFormat.prototype, "formatToParts", {
    configurable: true,
    value: () => [
      { type: "month", value: "09" },
      { type: "literal", value: "/" },
      { type: "day", value: "27" },
      { type: "literal", value: "/" },
      { type: "year", value: "2026" },
    ],
  });
  globalThis.Date = FixedDate;

  try {
    assert.equal(Number.isNaN(new OriginalDate("09/27/2026T00:00:00-05:00").getTime()), true);
    await service.getSnapshot({ period: "TODAY" }, actor);
  } finally {
    if (formatDescriptor) Object.defineProperty(Intl.DateTimeFormat.prototype, "format", formatDescriptor);
    if (formatToPartsDescriptor) Object.defineProperty(Intl.DateTimeFormat.prototype, "formatToParts", formatToPartsDescriptor);
    globalThis.Date = OriginalDate;
  }

  assert.equal(args[8], "2026-09-27T05:00:00.000Z");
  assert.equal(args[9], "2026-09-28T05:00:00.000Z");
  assert.doesNotThrow(() => new OriginalDate(args[8] as string).toISOString());
  assert.doesNotThrow(() => new OriginalDate(args[9] as string).toISOString());
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
