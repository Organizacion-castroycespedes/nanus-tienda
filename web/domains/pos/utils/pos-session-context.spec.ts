import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePosSessionContext } from "./pos-session-context";

describe("resolvePosSessionContext", () => {
  it("resolves readable branch and terminal names for the active tenant", () => {
    const resolved = resolvePosSessionContext(
      {
        tenants: [
          {
            id: "tenant-1",
            name: "Tenant 1",
            branches: [
              {
                id: "branch-1",
                name: "Sucursal Principal",
                terminals: [{ id: "terminal-1", name: "Terminal 1", code: "T1" }],
              },
            ],
          },
        ],
      },
      {
        posSessionId: "session-1",
        branchId: "branch-1",
        terminalId: "terminal-1",
      },
      "tenant-1"
    );

    assert.deepEqual(resolved, {
      tenantId: "tenant-1",
      branchId: "branch-1",
      branchName: "Sucursal Principal",
      terminalId: "terminal-1",
      terminalName: "Terminal 1",
      posSessionId: "session-1",
    });
  });

  it("keeps ids even when auth context names are unavailable", () => {
    const resolved = resolvePosSessionContext(
      null,
      {
        posSessionId: "session-1",
        branchId: "branch-1",
        terminalId: "terminal-1",
      },
      "tenant-1"
    );

    assert.deepEqual(resolved, {
      tenantId: "tenant-1",
      branchId: "branch-1",
      branchName: null,
      terminalId: "terminal-1",
      terminalName: null,
      posSessionId: "session-1",
    });
  });
});
