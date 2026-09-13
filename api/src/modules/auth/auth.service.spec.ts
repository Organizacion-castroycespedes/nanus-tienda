import assert from "node:assert/strict";
import { test } from "node:test";
import * as bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { AuthService } from "./auth.service";

const email = "qa-role@example.test";
const password = "qa-password";
const user = {
  id: "user-1",
  tenant_id: "tenant-1",
  tenant_slug: "tenant-uno",
  password_hash: bcrypt.hashSync(password, 4),
  estado: "ACTIVE",
  tenant_activo: true,
  role: "USER",
};

const buildService = (activeSession = false) => {
  let active = activeSession;
  let activeCount = active ? 1 : 0;
  let revocationUpdates = 0;
  let clientCalls = 0;
  const client = {
    query: async (sql: string) => {
      clientCalls += 1;
      if (sql.includes("SELECT id, is_active, refresh_token")) {
        return {
          rows: active
            ? [{ id: "old-session", is_active: true, refresh_token: "old-hash" }]
            : [],
        };
      }
      if (sql.includes("UPDATE auth_sessions") && sql.includes("RETURNING refresh_token")) {
        if (active) {
          active = false;
          activeCount -= 1;
          return { rows: [{ refresh_token: "old-hash" }] };
        }
        return { rows: [] };
      }
      if (sql.includes("UPDATE auth_refresh_tokens")) {
        revocationUpdates += 1;
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO auth_sessions")) {
        active = true;
        activeCount += 1;
        return { rows: [{ id: "new-session" }] };
      }
      return { rows: [] };
    },
    release: () => undefined,
  };
  const db = {
    query: async (sql: string) => {
      if (sql.includes("FROM users") && sql.includes("password_hash")) {
        return { rows: [user] };
      }
      return { rows: [] };
    },
    getClient: async () => client,
  };
  const service = new AuthService(db as never, {} as never);
  return {
    service,
    get activeCount() {
      return activeCount;
    },
    get revocationUpdates() {
      return revocationUpdates;
    },
    get clientCalls() {
      return clientCalls;
    },
  };
};

test("first login creates exactly one active session", async () => {
  const fixture = buildService();
  const tokens = await fixture.service.login({ email, password });

  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);
  assert.equal(fixture.activeCount, 1);
});

test("normal login rejects active session and replacement revokes old session atomically", async () => {
  const fixture = buildService(true);

  await assert.rejects(
    fixture.service.login({ email, password }),
    (error: any) => error?.status === 409 && error?.response?.code === "SESSION_ACTIVE"
  );
  assert.equal(fixture.activeCount, 1);

  const tokens = await fixture.service.replaceActiveSession({ email, password });
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);
  assert.equal(fixture.activeCount, 1);
  assert.equal(fixture.revocationUpdates, 1);
});

test("wrong password cannot revoke an active session", async () => {
  const fixture = buildService(true);

  await assert.rejects(fixture.service.replaceActiveSession({ email, password: "wrong" }));
  assert.equal(fixture.activeCount, 1);
  assert.equal(fixture.clientCalls, 0);
});

test("replaced refresh token is rejected while the newest refresh token remains valid", async () => {
  const oldRefreshToken = "old-refresh-token";
  const oldHash = crypto.createHash("sha256").update(oldRefreshToken).digest("hex");
  const client = {
    query: async (sql: string, params: any[] = []) => {
      if (sql.includes("FROM auth_refresh_tokens art")) {
        return {
          rows: [{
            id: "refresh-1",
            user_id: user.id,
            tenant_id: user.tenant_id,
            tenant_slug: user.tenant_slug,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            revoked_at: params[0] === oldHash ? new Date().toISOString() : null,
            user_estado: "ACTIVE",
            tenant_activo: true,
          }],
        };
      }
      if (sql.includes("FROM auth_sessions") && sql.includes("WHERE user_id")) {
        return { rows: [{ id: "new-session", is_active: true, refresh_token: params[2] }] };
      }
      if (sql.includes("SELECT roles.nombre")) {
        return { rows: [{ nombre: user.role }] };
      }
      return { rows: [] };
    },
    release: () => undefined,
  };
  const db = { getClient: async () => client, query: async () => ({ rows: [] }) };
  const service = new AuthService(db as never, {} as never);

  await assert.rejects(service.refreshToken({ refreshToken: oldRefreshToken }));
  const tokens = await service.refreshToken({ refreshToken: "new-refresh-token" });
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);
});
