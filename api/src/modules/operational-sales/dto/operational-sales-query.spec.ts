import assert from "node:assert/strict";
import test from "node:test";
import { resolveOperationalDates } from "./operational-sales-query.dto";

test("operational sales uses Bogotá calendar boundaries", () => {
  const dates = resolveOperationalDates("2026-09-25", "2026-09-25", new Date("2026-09-27T12:00:00.000Z"));
  assert.deepEqual(dates, { dateFrom: "2026-09-25T05:00:00.000Z", dateTo: "2026-09-26T05:00:00.000Z" });
});

test("operational sales rejects future and old dates", () => {
  const now = new Date("2026-09-27T12:00:00.000Z");
  assert.throws(() => resolveOperationalDates("2026-09-28", "2026-09-28", now), /últimos 3 meses/);
  assert.throws(() => resolveOperationalDates("2026-06-26", "2026-06-26", now), /últimos 3 meses/);
});
