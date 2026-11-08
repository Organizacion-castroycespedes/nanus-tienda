import assert from "node:assert/strict";
import test from "node:test";
import { addDays, addMonthsClamped, dayOfMonth, parseIsoDate, todayInBogota } from "./dates";

test("dates: validates real calendar dates", () => {
  assert.equal(parseIsoDate("2026-12-15", "f"), "2026-12-15");
  assert.throws(() => parseIsoDate("2026-02-30", "fecha"), /fecha/);
  assert.throws(() => parseIsoDate("15/12/2026", "fecha"), /fecha/);
});

test("dates: one month trial from contract start", () => {
  assert.equal(addMonthsClamped("2026-12-15", 1), "2027-01-15");
});

test("dates: month-end clamp for contracts starting on day 31", () => {
  assert.equal(addMonthsClamped("2027-01-31", 1), "2027-02-28");
  assert.equal(addMonthsClamped("2028-01-31", 1), "2028-02-29");
  assert.equal(dayOfMonth("2027-01-31"), 31);
});

test("dates: add days crosses month and year", () => {
  assert.equal(addDays("2027-01-01", -1), "2026-12-31");
});

test("dates: today in Bogota is UTC-5", () => {
  assert.equal(todayInBogota(new Date("2026-11-08T03:00:00Z")), "2026-11-07");
  assert.equal(todayInBogota(new Date("2026-11-08T06:00:00Z")), "2026-11-08");
});
