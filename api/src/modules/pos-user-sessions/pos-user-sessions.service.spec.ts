import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { PosUserSessionsService } from "./pos-user-sessions.service";

const ids = {
  authSession: "auth-session-001",
  branch: "branch-001",
  otherBranch: "branch-002",
  terminal: "terminal-001",
  tenant: "tenant-001",
  user: "user-001",
};

const actor = {
  roles: ["USER"],
  tenantId: ids.tenant,
  userId: ids.user,
  sessionId: ids.authSession,
};

const buildHarness = (options: { branchAllowed?: boolean } = {}) => {
  const queries: string[] = [];
  let terminalChecks = 0;
  let createdPayload: Record<string, unknown> | null = null;

  const client = {
    query: async (query: string) => {
      queries.push(query);
      return { rows: [] };
    },
    release: () => undefined,
  };

  const repository = {
    validateAuthSession: async () => ({
      id: ids.authSession,
      user_id: ids.user,
      tenant_id: ids.tenant,
      is_active: true,
    }),
    validateTerminal: async () => {
      terminalChecks += 1;
      return {
        id: ids.terminal,
        tenant_id: ids.tenant,
        branch_id: ids.branch,
        is_active: true,
      };
    },
    deactivateUserSessions: async () => undefined,
    createSession: async (_client: unknown, payload: Record<string, unknown>) => {
      createdPayload = payload;
      return {
        id: "pos-session-001",
        auth_session_id: payload.authSessionId,
        user_id: payload.userId,
        tenant_id: payload.tenantId,
        branch_id: payload.branchId,
        terminal_id: payload.terminalId,
        started_at: "2026-06-12T00:00:00.000Z",
        ended_at: null,
        is_active: true,
      };
    },
  };

  const db = {
    getClient: async () => client,
  };

  const accessControl = {
    canAccessBranch: async () => options.branchAllowed ?? true,
  };

  const auditService = {
    logEvent: () => undefined,
  };

  return {
    service: new PosUserSessionsService(
      repository as never,
      db as never,
      accessControl as never,
      auditService as never
    ),
    getCreatedPayload: () => createdPayload,
    getTerminalChecks: () => terminalChecks,
    getQueries: () => queries,
  };
};

describe("PosUserSessionsService", () => {
  it("creates a POS session for an assigned branch and terminal", async () => {
    const harness = buildHarness();

    const result = await harness.service.createPosSession(
      { branchId: ids.branch, terminalId: ids.terminal },
      actor
    );

    assert.equal(result?.branch_id, ids.branch);
    assert.equal(result?.terminal_id, ids.terminal);
    assert.equal(harness.getCreatedPayload()?.branchId, ids.branch);
    assert.equal(harness.getTerminalChecks(), 1);
    assert.deepEqual(harness.getQueries(), ["BEGIN", "COMMIT"]);
  });

  it("rejects a POS session for a branch outside the actor scope", async () => {
    const harness = buildHarness({ branchAllowed: false });

    await assert.rejects(
      () =>
        harness.service.createPosSession(
          { branchId: ids.otherBranch, terminalId: ids.terminal },
          actor
        ),
      ForbiddenException
    );

    assert.equal(harness.getTerminalChecks(), 0);
    assert.deepEqual(harness.getQueries(), ["BEGIN", "ROLLBACK"]);
  });

  it("closes one active session and audits it when the terminal is operationally safe", async () => {
    const queries: string[] = [];
    const client = {
      query: async (query: string) => {
        queries.push(query);
        return { rows: [] };
      },
      release: () => undefined,
    };
    const repository = {
      validateTerminal: async () => ({
        id: ids.terminal,
        tenant_id: ids.tenant,
        branch_id: ids.branch,
        is_active: true,
      }),
      findActiveForAdmin: async () => ({
        id: "pos-session-001",
        auth_session_id: ids.authSession,
        user_id: ids.user,
        tenant_id: ids.tenant,
        branch_id: ids.branch,
        terminal_id: ids.terminal,
        started_at: "2026-06-12T00:00:00.000Z",
        ended_at: null,
        is_active: true,
        user_email: "operator@example.test",
        user_display_name: "Operator QA",
        terminal_code: "TERM-001",
        terminal_name: "Terminal 1",
        branch_name: "QA",
        has_open_cash: false,
        pending_sales: 0,
        pending_payments: 0,
      }),
      getSafetyForSession: async () => ({ has_open_cash: false, pending_sales: 0, pending_payments: 0 }),
      closeOne: async () => ({
        id: "pos-session-001",
        auth_session_id: ids.authSession,
        user_id: ids.user,
        tenant_id: ids.tenant,
        branch_id: ids.branch,
        terminal_id: ids.terminal,
        started_at: "2026-06-12T00:00:00.000Z",
        ended_at: "2026-06-12T01:00:00.000Z",
        is_active: false,
      }),
    };
    const service = new PosUserSessionsService(
      repository as never,
      { getClient: async () => client } as never,
      { canAccessBranch: async () => true } as never,
      { logEvent: (event: { action: string }) => assert.equal(event.action, "POS_SESSION_ADMIN_CLOSED") } as never,
    );

    const result = await service.closeOne(
      "pos-session-001",
      { branchId: ids.branch, terminalId: ids.terminal, reason: "Cierre administrativo QA" },
      { roles: ["SUPER_ADMIN"], tenantId: ids.tenant, userId: ids.user },
    );

    assert.equal(result.isActive, false);
    assert.deepEqual(queries, ["BEGIN", "COMMIT"]);
  });

  it("does not close a session when its terminal has open cash", async () => {
    const queries: string[] = [];
    const client = {
      query: async (query: string) => {
        queries.push(query);
        return { rows: [] };
      },
      release: () => undefined,
    };
    const repository = {
      validateTerminal: async () => ({ id: ids.terminal, tenant_id: ids.tenant, branch_id: ids.branch, is_active: true }),
      findActiveForAdmin: async () => ({ id: "pos-session-001", terminal_id: ids.terminal, is_active: true }),
      getSafetyForSession: async () => ({ has_open_cash: true, pending_sales: 0, pending_payments: 0 }),
      closeOne: async () => {
        throw new Error("no debe cerrar");
      },
    };
    const service = new PosUserSessionsService(
      repository as never,
      { getClient: async () => client } as never,
      { canAccessBranch: async () => true } as never,
      { logEvent: () => undefined } as never,
    );

    await assert.rejects(
      () => service.closeOne(
        "pos-session-001",
        { branchId: ids.branch, terminalId: ids.terminal, reason: "Cierre administrativo QA" },
        { roles: ["SUPER_ADMIN"], tenantId: ids.tenant, userId: ids.user },
      ),
      /caja abierta/i,
    );
    assert.deepEqual(queries, ["BEGIN", "ROLLBACK"]);
  });
});
