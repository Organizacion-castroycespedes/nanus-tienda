import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countActiveListFilters,
  formatListFiltersTitle,
  readFiltersPanelOpen,
  writeFiltersPanelOpen,
} from "./list-filters";

const defaults = { query: "", branchId: "", fromDate: "", toDate: "", status: "" };

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

describe("list filters", () => {
  it("counts only filters that differ from their defaults", () => {
    assert.equal(countActiveListFilters(defaults, defaults), 0);
    assert.equal(
      countActiveListFilters({ ...defaults, fromDate: "2026-11-01", branchId: "b1", query: "   " }, defaults),
      2
    );
  });

  it("adds extra active indicators such as the cash scope", () => {
    assert.equal(countActiveListFilters(defaults, defaults, [true, false]), 1);
  });

  it("formats the panel title with the active count", () => {
    assert.equal(formatListFiltersTitle(0), "Filtros");
    assert.equal(formatListFiltersTitle(2), "Filtros (2)");
  });

  it("is hidden by default and remembers the last choice", () => {
    const storage = memoryStorage();
    assert.equal(readFiltersPanelOpen("orders", false, storage), false);
    writeFiltersPanelOpen("orders", true, storage);
    assert.equal(readFiltersPanelOpen("orders", false, storage), true);
    writeFiltersPanelOpen("orders", false, storage);
    assert.equal(readFiltersPanelOpen("orders", true, storage), false);
    assert.equal(readFiltersPanelOpen("purchases", false, storage), false);
  });

  it("falls back to the default when storage is unavailable or throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    assert.equal(readFiltersPanelOpen("orders", false, null), false);
    assert.equal(readFiltersPanelOpen("orders", false, throwing), false);
    assert.doesNotThrow(() => writeFiltersPanelOpen("orders", true, throwing));
  });
});
