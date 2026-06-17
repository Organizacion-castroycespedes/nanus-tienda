import assert from "node:assert/strict";
import test from "node:test";
import {
  getContrastRatio,
  getReadableTextColor,
  isValidHexColor,
  normalizeHexColor,
} from "./colors";

test("normalizes short and long hex colors", () => {
  assert.equal(normalizeHexColor("#abc"), "#AABBCC");
  assert.equal(normalizeHexColor("2563eb"), "#2563EB");
  assert.equal(normalizeHexColor("#F97316"), "#F97316");
});

test("rejects invalid hex colors", () => {
  assert.equal(isValidHexColor("blue"), false);
  assert.equal(isValidHexColor("#12"), false);
  assert.equal(isValidHexColor(null), false);
  assert.equal(normalizeHexColor(undefined), null);
});

test("calculates readable contrast colors", () => {
  assert.equal(getReadableTextColor("#0F172A"), "#FFFFFF");
  assert.equal(getReadableTextColor("#F8FAFC"), "#0F172A");
  assert.ok(getContrastRatio("#FFFFFF", "#0F172A") >= 4.5);
});

test("invalid contrast inputs are safe", () => {
  assert.equal(getContrastRatio("zzzzzz", "#FFFFFF"), 1);
  assert.equal(getReadableTextColor("zzzzzz"), "#0F172A");
});
