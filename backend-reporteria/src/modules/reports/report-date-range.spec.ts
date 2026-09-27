import assert from "node:assert/strict";
import test from "node:test";
import { formatReportDateTime, resolveReportDateRange } from "./report-date-range";

test("resolves Bogotá calendar midnight to UTC and keeps today's cut-off", () => {
  const result = resolveReportDateRange(
    { dateFrom: "2026-09-27", dateTo: "2026-09-27" },
    new Date("2026-09-27T18:30:12.123Z"),
  );
  assert.equal(result.dateFrom, "2026-09-27T05:00:00.000Z");
  assert.equal(result.dateTo, "2026-09-27T18:30:12.123Z");
  assert.equal(result.timeZone, "America/Bogota");
});

test("defaults to the current Bogotá day when dates are absent", () => {
  const result = resolveReportDateRange({}, new Date("2026-09-27T18:30:12.123Z"));
  assert.equal(result.dateFrom, "2026-09-27T05:00:00.000Z");
  assert.equal(result.dateTo, "2026-09-27T18:30:12.123Z");
});

test("accepts the exact three-month boundary and handles month-end clamp", () => {
  const boundary = resolveReportDateRange(
    { dateFrom: "2026-06-27", dateTo: "2026-06-27" },
    new Date("2026-09-27T12:00:00.000Z"),
  );
  assert.equal(boundary.dateFrom, "2026-06-27T05:00:00.000Z");
  const monthEnd = resolveReportDateRange(
    { dateFrom: "2026-02-28", dateTo: "2026-02-28" },
    new Date("2026-05-31T12:00:00.000Z"),
  );
  assert.equal(monthEnd.dateFrom, "2026-02-28T05:00:00.000Z");
  assert.throws(() => resolveReportDateRange({ dateFrom: "2026-06-26", dateTo: "2026-06-26" }, new Date("2026-09-27T12:00:00Z")));
});

test("uses the next local midnight for a historical date", () => {
  const result = resolveReportDateRange(
    { dateFrom: "2026-09-25", dateTo: "2026-09-25" },
    new Date("2026-09-27T12:00:00.000Z"),
  );
  assert.equal(result.dateFrom, "2026-09-25T05:00:00.000Z");
  assert.equal(result.dateTo, "2026-09-26T05:00:00.000Z");
});

test("handles leap day and rejects future or inverted ranges", () => {
  const leap = resolveReportDateRange(
    { dateFrom: "2024-02-29", dateTo: "2024-02-29" },
    new Date("2024-05-29T12:00:00.000Z"),
  );
  assert.equal(leap.dateTo, "2024-03-01T05:00:00.000Z");
  assert.throws(() => resolveReportDateRange({ dateFrom: "2026-09-28", dateTo: "2026-09-28" }, new Date("2026-09-27T12:00:00Z")));
  assert.throws(() => resolveReportDateRange({ dateFrom: "2026-09-27", dateTo: "2026-09-26" }, new Date("2026-09-27T12:00:00Z")));
});

test("formats UTC timestamps as Bogotá wall-clock strings for Excel", () => {
  const formatted = formatReportDateTime("2026-09-26T05:00:00.000Z");
  assert.match(formatted, /26\/09\/2026/);
  assert.match(formatted, /00:00:00/);
  assert.match(formatted, /\[America\/Bogota\]/);
});
