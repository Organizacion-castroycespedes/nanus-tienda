import assert from "node:assert/strict";
import test from "node:test";
import { PlatformTenantGuard } from "./platform-tenant.guard";
import { DEFAULT_PLATFORM_TENANT_ID } from "../../modules/control-center/control-center.config";

const buildContext = (user: { id?: string; tenantId?: string } | undefined) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as any;

const buildDb = (rows: unknown[]) => {
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  return {
    calls,
    db: {
      query: async (text: string, params?: unknown[]) => {
        calls.push({ text, params });
        return { rows };
      },
    } as any,
  };
};

test("PlatformTenantGuard: allows active SUPER_ADMIN of the platform tenant", async () => {
  delete process.env.PLATFORM_TENANT_ID;
  const { db, calls } = buildDb([{ allowed: 1 }]);
  const guard = new PlatformTenantGuard(db);
  const allowed = await guard.canActivate(
    buildContext({ id: "user-1", tenantId: DEFAULT_PLATFORM_TENANT_ID }),
  );
  assert.equal(allowed, true);
  assert.deepEqual(calls[0].params, ["user-1", DEFAULT_PLATFORM_TENANT_ID]);
  assert.match(calls[0].text, /r\.nombre = 'SUPER_ADMIN'/);
  assert.match(calls[0].text, /u\.estado = 'ACTIVE'/);
  assert.match(calls[0].text, /t\.activo = TRUE/);
});

test("PlatformTenantGuard: rejects SUPER_ADMIN from another tenant without querying", async () => {
  const { db, calls } = buildDb([{ allowed: 1 }]);
  const guard = new PlatformTenantGuard(db);
  await assert.rejects(
    () => guard.canActivate(buildContext({ id: "user-1", tenantId: "11111111-1111-1111-1111-111111111111" })),
    /Acceso denegado/,
  );
  assert.equal(calls.length, 0);
});

test("PlatformTenantGuard: rejects revoked role, inactive user or inactive platform tenant", async () => {
  const { db } = buildDb([]);
  const guard = new PlatformTenantGuard(db);
  await assert.rejects(
    () => guard.canActivate(buildContext({ id: "user-1", tenantId: DEFAULT_PLATFORM_TENANT_ID })),
    /Acceso denegado/,
  );
});

test("PlatformTenantGuard: rejects requests without authenticated user", async () => {
  const { db } = buildDb([{ allowed: 1 }]);
  const guard = new PlatformTenantGuard(db);
  await assert.rejects(() => guard.canActivate(buildContext(undefined)), /Acceso denegado/);
});

test("PlatformTenantGuard: honors PLATFORM_TENANT_ID override", async () => {
  const custom = "22222222-2222-2222-2222-222222222222";
  process.env.PLATFORM_TENANT_ID = custom;
  try {
    const { db, calls } = buildDb([{ allowed: 1 }]);
    const guard = new PlatformTenantGuard(db);
    assert.equal(await guard.canActivate(buildContext({ id: "u", tenantId: custom })), true);
    assert.deepEqual(calls[0].params, ["u", custom]);
    await assert.rejects(
      () => guard.canActivate(buildContext({ id: "u", tenantId: DEFAULT_PLATFORM_TENANT_ID })),
      /Acceso denegado/,
    );
  } finally {
    delete process.env.PLATFORM_TENANT_ID;
  }
});
