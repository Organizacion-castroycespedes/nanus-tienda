import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  clearRefreshToken,
  getStoredRefreshToken,
  hasPersistedRefreshToken,
  persistRefreshToken,
} from "./session";

const globalAny = globalThis as typeof globalThis & {
  window?: { localStorage: Storage; sessionStorage: Storage };
};

const buildStorage = () => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  } satisfies Storage;
};

afterEach(() => {
  clearRefreshToken();
  delete globalAny.window;
});

describe("refresh token storage compatibility", () => {
  it("keeps a non-persistent login in memory only", () => {
    const localStorage = buildStorage();
    globalAny.window = { localStorage, sessionStorage: buildStorage() };

    persistRefreshToken("refresh-memory", { persist: false });

    assert.equal(getStoredRefreshToken(), "refresh-memory");
    assert.equal(localStorage.getItem("smg_refresh_token"), null);
    assert.equal(hasPersistedRefreshToken(), false);
  });

  it("reads and migrates the legacy sessionStorage token", () => {
    const localStorage = buildStorage();
    const sessionStorage = buildStorage();
    sessionStorage.setItem("smg_refresh_token", "legacy-refresh");
    globalAny.window = { localStorage, sessionStorage };

    assert.equal(getStoredRefreshToken(), "legacy-refresh");
    assert.equal(sessionStorage.getItem("smg_refresh_token"), null);
    assert.equal(localStorage.getItem("smg_refresh_token"), "legacy-refresh");
  });
});
