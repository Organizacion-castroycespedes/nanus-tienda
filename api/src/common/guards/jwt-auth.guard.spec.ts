import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import "reflect-metadata";
import jwt from "jsonwebtoken";
import { REQUIRE_OPEN_CASH_SESSION_KEY } from "../decorators/require-open-cash-session.decorator";
import { REQUIRE_POS_SESSION_KEY } from "../decorators/require-pos-session.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "jwt-auth-guard-test-secret";

const ids = {
  authSession: "10000000-0000-4000-8000-000000000001",
  branch: "10000000-0000-4000-8000-000000000002",
  cashSession: "10000000-0000-4000-8000-000000000005",
  posSession: "10000000-0000-4000-8000-000000000003",
  tenant: "tenant-001",
  terminal: "10000000-0000-4000-8000-000000000004",
  user: "user-001",
};

const buildToken = () =>
  jwt.sign(
    {
      sub: ids.user,
      tenant_id: ids.tenant,
      roles: ["USER"],
      session_id: ids.authSession,
    },
    process.env.JWT_SECRET as string
  );

const buildDb = (posRows: unknown[] = [], cashRows: unknown[] = []) => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  return {
    db: {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        if (sql.includes("FROM auth_sessions")) {
          return { rows: [{ id: ids.authSession }] };
        }
        if (sql.includes("FROM cash_sessions")) {
          return { rows: cashRows };
        }
        return { rows: posRows };
      },
    },
    queries,
  };
};

const buildContext = (
  request: Record<string, unknown>,
  requiresPosSession = false,
  requiresOpenCashSession = false
) => {
  const handler = () => undefined;
  if (requiresPosSession) {
    Reflect.defineMetadata(REQUIRE_POS_SESSION_KEY, true, handler);
  }
  if (requiresOpenCashSession) {
    Reflect.defineMetadata(REQUIRE_OPEN_CASH_SESSION_KEY, true, handler);
  }

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => ({}),
  } as any;
};

test("JwtAuthGuard: ignores invalid optional POS session header on non-POS endpoints", async () => {
  const { db, queries } = buildDb([]);
  const guard = new JwtAuthGuard(db as never);
  const request: Record<string, unknown> = {
    headers: {
      authorization: `Bearer ${buildToken()}`,
      "x-pos-session-id": "10000000-0000-4000-8000-000000000099",
    },
  };

  const allowed = await guard.canActivate(buildContext(request));

  assert.equal(allowed, true);
  assert.equal(queries.length, 2);
  assert.equal((request as { context?: unknown }).context, undefined);
});

test("JwtAuthGuard: rejects invalid POS session when endpoint requires it", async () => {
  const { db } = buildDb([]);
  const guard = new JwtAuthGuard(db as never);
  const request = {
    headers: {
      authorization: `Bearer ${buildToken()}`,
      "x-pos-session-id": "10000000-0000-4000-8000-000000000099",
    },
  };

  await assert.rejects(
    () => guard.canActivate(buildContext(request, true)),
    ForbiddenException
  );
});

test("JwtAuthGuard: ignores malformed optional POS session header on non-POS endpoints", async () => {
  const { db, queries } = buildDb([]);
  const guard = new JwtAuthGuard(db as never);
  const request: Record<string, unknown> = {
    headers: {
      authorization: `Bearer ${buildToken()}`,
      "x-pos-session-id": "local-terminal",
    },
  };

  const allowed = await guard.canActivate(buildContext(request));

  assert.equal(allowed, true);
  assert.equal(queries.length, 1);
  assert.equal((request as { context?: unknown }).context, undefined);
});

test("JwtAuthGuard: rejects malformed POS session header when endpoint requires it", async () => {
  const { db, queries } = buildDb([]);
  const guard = new JwtAuthGuard(db as never);
  const request = {
    headers: {
      authorization: `Bearer ${buildToken()}`,
      "x-pos-session-id": "local-terminal",
    },
  };

  await assert.rejects(
    () => guard.canActivate(buildContext(request, true)),
    ForbiddenException
  );
  assert.equal(queries.length, 1);
});

test("JwtAuthGuard: hydrates POS context when POS session header is valid", async () => {
  const { db } = buildDb([
    {
      id: ids.posSession,
      tenant_id: ids.tenant,
      branch_id: ids.branch,
      terminal_id: ids.terminal,
      user_id: ids.user,
    },
  ]);
  const guard = new JwtAuthGuard(db as never);
  const request: Record<string, unknown> = {
    headers: {
      authorization: `Bearer ${buildToken()}`,
      "x-pos-session-id": ids.posSession,
    },
  };

  const allowed = await guard.canActivate(buildContext(request));

  assert.equal(allowed, true);
  assert.deepEqual((request as { context?: unknown }).context, {
    tenantId: ids.tenant,
    branchId: ids.branch,
    terminalId: ids.terminal,
    posSessionId: ids.posSession,
    userId: ids.user,
  });
});

test("JwtAuthGuard: hydrates required POS context from active auth POS session when header is missing", async () => {
  const { db, queries } = buildDb([
    {
      id: ids.posSession,
      tenant_id: ids.tenant,
      branch_id: ids.branch,
      terminal_id: ids.terminal,
      user_id: ids.user,
    },
  ]);
  const guard = new JwtAuthGuard(db as never);
  const request: Record<string, unknown> = {
    headers: {
      authorization: `Bearer ${buildToken()}`,
    },
  };

  const allowed = await guard.canActivate(buildContext(request, true));

  assert.equal(allowed, true);
  assert.equal(queries.length, 2);
  assert.deepEqual((request as { context?: unknown }).context, {
    tenantId: ids.tenant,
    branchId: ids.branch,
    terminalId: ids.terminal,
    posSessionId: ids.posSession,
    userId: ids.user,
  });
  assert.deepEqual(queries[1].params, [ids.user, ids.tenant, ids.authSession]);
});

test("JwtAuthGuard: rejects missing POS session when endpoint requires it", async () => {
  const { db, queries } = buildDb([]);
  const guard = new JwtAuthGuard(db as never);
  const request = {
    headers: {
      authorization: `Bearer ${buildToken()}`,
    },
  };

  await assert.rejects(
    () => guard.canActivate(buildContext(request, true)),
    ForbiddenException
  );
  assert.equal(queries.length, 2);
});

test("JwtAuthGuard: rejects operational mutation without open cash session", async () => {
  const { db, queries } = buildDb([], []);
  const guard = new JwtAuthGuard(db as never);
  const request = {
    headers: {
      authorization: `Bearer ${buildToken()}`,
    },
  };

  await assert.rejects(
    () => guard.canActivate(buildContext(request, false, true)),
    (error: unknown) =>
      error instanceof ForbiddenException &&
      error.message === "Debes tener una caja abierta para realizar esta operacion."
  );
  assert.equal(queries.length, 2);
});

test("JwtAuthGuard: hydrates cash session context for operational mutation", async () => {
  const { db, queries } = buildDb([], [
    {
      id: ids.cashSession,
      tenant_id: ids.tenant,
      branch_id: ids.branch,
      terminal_id: ids.terminal,
      opened_by_user_id: ids.user,
    },
  ]);
  const guard = new JwtAuthGuard(db as never);
  const request: Record<string, unknown> = {
    headers: {
      authorization: `Bearer ${buildToken()}`,
    },
  };

  const allowed = await guard.canActivate(buildContext(request, false, true));

  assert.equal(allowed, true);
  assert.equal(queries.length, 2);
  assert.deepEqual((request as { context?: unknown }).context, {
    tenantId: ids.tenant,
    branchId: ids.branch,
    terminalId: ids.terminal,
    userId: ids.user,
    cashSessionId: ids.cashSession,
  });
});

test("JwtAuthGuard: rejects POS context without matching open cash session", async () => {
  const { db, queries } = buildDb(
    [
      {
        id: ids.posSession,
        tenant_id: ids.tenant,
        branch_id: ids.branch,
        terminal_id: ids.terminal,
        user_id: ids.user,
      },
    ],
    []
  );
  const guard = new JwtAuthGuard(db as never);
  const request = {
    headers: {
      authorization: `Bearer ${buildToken()}`,
      "x-pos-session-id": ids.posSession,
    },
  };

  await assert.rejects(
    () => guard.canActivate(buildContext(request, true, true)),
    (error: unknown) =>
      error instanceof ForbiddenException &&
      error.message === "La operacion requiere la caja actual del usuario."
  );
  assert.equal(queries.length, 3);
});
