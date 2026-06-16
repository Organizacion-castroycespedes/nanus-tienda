import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import "reflect-metadata";
import jwt from "jsonwebtoken";
import { REQUIRE_POS_SESSION_KEY } from "../decorators/require-pos-session.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "jwt-auth-guard-test-secret";

const ids = {
  authSession: "10000000-0000-4000-8000-000000000001",
  branch: "10000000-0000-4000-8000-000000000002",
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

const buildDb = (posRows: unknown[] = []) => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  return {
    db: {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        if (queries.length === 1) {
          return { rows: [{ id: ids.authSession }] };
        }
        return { rows: posRows };
      },
    },
    queries,
  };
};

const buildContext = (request: Record<string, unknown>, requiresPosSession = false) => {
  const handler = () => undefined;
  if (requiresPosSession) {
    Reflect.defineMetadata(REQUIRE_POS_SESSION_KEY, true, handler);
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
