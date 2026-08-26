import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import posReducer, {
  initialPosState,
  loadPersistedPosState,
  persistPosState,
  setContext,
  setSession,
} from "./pos";

const globalAny = globalThis as typeof globalThis & {
  window?: {
    localStorage: {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    };
  };
};

afterEach(() => {
  delete globalAny.window;
});

describe("POS context state", () => {
  it("keeps readable branch and terminal names in context state", () => {
    const next = posReducer(
      initialPosState,
      setContext({
        tenantId: "tenant-1",
        branchId: "branch-1",
        branchName: "Sucursal Principal",
        terminalId: "terminal-1",
        terminalName: "Terminal 1",
      })
    );

    assert.equal(next.branchId, "branch-1");
    assert.equal(next.branchName, "Sucursal Principal");
    assert.equal(next.terminalId, "terminal-1");
    assert.equal(next.terminalName, "Terminal 1");
  });

  it("keeps readable branch and terminal names in session state", () => {
    const next = posReducer(
      initialPosState,
      setSession({
        posSessionId: "session-1",
        branchId: "branch-1",
        branchName: "Sucursal Principal",
        terminalId: "terminal-1",
        terminalName: "Terminal 1",
        cashRegisterId: "cash-1",
      })
    );

    assert.equal(next.posSessionId, "session-1");
    assert.equal(next.branchName, "Sucursal Principal");
    assert.equal(next.terminalName, "Terminal 1");
  });

  it("persists and reloads readable POS context names", () => {
    const storage = new Map<string, string>();

    globalAny.window = {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
    };

    persistPosState({
      ...initialPosState,
      tenantId: "tenant-1",
      branchId: "branch-1",
      branchName: "Sucursal Principal",
      terminalId: "terminal-1",
      terminalName: "Terminal 1",
      cashRegisterId: "cash-1",
      posSessionId: "session-1",
      loading: false,
      error: null,
    });

    assert.deepEqual(loadPersistedPosState(), {
      tenantId: "tenant-1",
      branchId: "branch-1",
      branchName: "Sucursal Principal",
      terminalId: "terminal-1",
      terminalName: "Terminal 1",
      cashRegisterId: "cash-1",
      posSessionId: "session-1",
    });
  });
});
