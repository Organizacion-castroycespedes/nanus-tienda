import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { OperationalSaleScopeService } from "./operational-sale-scope.service";

const createService = (rows: any[]) => {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  const db = {
    query: async (text: string, params: unknown[] = []) => {
      calls.push({ text, params });
      return { rows };
    },
  };
  const access = {
    isSuperAdmin: (actor: any) => actor.roles?.includes("SUPER_ADMIN") ?? false,
    resolveTenantId: (actor: any, requested?: string | null) =>
      requested?.trim() || actor.tenantId || null,
    canAccessTenant: (actor: any, tenantId: string) =>
      actor.roles?.includes("SUPER_ADMIN") || actor.tenantId === tenantId,
    canAccessBranch: async () => true,
    getAccessibleBranchIds: async () => ["branch-a", "branch-b"],
  };
  return {
    service: new OperationalSaleScopeService(db as any, access as any),
    calls,
  };
};

const actor = (role: string, overrides: Record<string, unknown> = {}) => ({
  id: "user-a",
  tenantId: "tenant-a",
  branchId: "branch-a",
  roles: [role],
  ...overrides,
});

test("USER resolves the unique current OPEN cash session", async () => {
  const { service, calls } = createService([
    { id: "cash-a", tenant_id: "tenant-a", branch_id: "branch-a", opened_by_user_id: "user-a" },
  ]);

  const scope = await service.resolveScope(actor("USER"));

  assert.equal(scope.tenantId, "tenant-a");
  assert.deepEqual(scope.branchIds, ["branch-a"]);
  assert.equal(scope.cashSessionId, "cash-a");
  assert.equal(scope.requiresCurrentShift, true);
  assert.deepEqual(calls[0].params, ["tenant-a", "branch-a", "user-a"]);
});

test("USER fails closed when there is no current OPEN cash session", async () => {
  const { service } = createService([]);

  await assert.rejects(
    () => service.resolveScope(actor("USER")),
    (error: unknown) =>
      error instanceof ForbiddenException && error.message === "No hay un turno actual abierto"
  );
});

test("USER fails closed when current OPEN cash sessions are ambiguous", async () => {
  const { service } = createService([{ id: "cash-a" }, { id: "cash-b" }]);

  await assert.rejects(
    () => service.resolveScope(actor("USER")),
    (error: unknown) =>
      error instanceof ForbiddenException && error.message === "Turnos actuales ambiguos"
  );
});

test("ADMIN scope does not require an open shift", async () => {
  const { service } = createService([]);

  const scope = await service.resolveScope(actor("ADMIN"));

  assert.deepEqual(scope.branchIds, ["branch-a"]);
  assert.equal(scope.requiresCurrentShift, false);
});

test("SUPER_USER spans authorized branches inside its tenant", async () => {
  const { service } = createService([]);

  const scope = await service.resolveScope(actor("SUPER_USER", { branchId: undefined }));

  assert.equal(scope.tenantId, "tenant-a");
  assert.deepEqual(scope.branchIds, ["branch-a", "branch-b"]);
  assert.equal(scope.requiresCurrentShift, false);
});

test("tenant and branch filters cannot expand USER scope", async () => {
  const { service } = createService([
    { id: "cash-a", tenant_id: "tenant-a", branch_id: "branch-a", opened_by_user_id: "user-a" },
  ]);

  await assert.rejects(() => service.resolveScope(actor("USER"), "tenant-b", "branch-b"));
});

test("query filters only narrow the authorized scope", async () => {
  const { service } = createService([
    { id: "cash-current", tenant_id: "tenant-a", branch_id: "branch-a", opened_by_user_id: "user-a" },
  ]);

  const sameScope = await service.resolveQueryScope(actor("USER"), {
    tenantId: "tenant-a",
    branchId: "branch-a",
    cashSessionId: "cash-current",
    userId: "user-a",
  });
  assert.deepEqual(sameScope.branchIds, ["branch-a"]);

  const narrowedToEmpty = await service.resolveQueryScope(actor("USER"), {
    cashSessionId: "cash-previous",
    userId: "user-other",
  });
  assert.deepEqual(narrowedToEmpty.branchIds, []);
  assert.equal(narrowedToEmpty.tenantId, "tenant-a");
});

test("USER cannot access a sale from a previous shift", async () => {
  const { service } = createService([
    { id: "cash-current", tenant_id: "tenant-a", branch_id: "branch-a", opened_by_user_id: "user-a" },
  ]);

  const allowed = await service.canAccessSale(
    actor("USER"),
    { tenantId: "tenant-a", branchId: "branch-a", cashSessionId: "cash-previous" },
    "VIEW"
  );

  assert.equal(allowed, false);
});

test("tenant-scoped ADMIN and SUPER_USER cannot cross tenants", async () => {
  const { service } = createService([]);

  await assert.rejects(() =>
    service.resolveScope(actor("ADMIN"), "tenant-b", "branch-a")
  );
  await assert.rejects(() =>
    service.resolveScope(actor("SUPER_USER"), "tenant-b", "branch-a")
  );
});

test("branch-scoped ADMIN cannot access an unauthorized branch", async () => {
  const { service } = createService([]);

  await assert.rejects(() =>
    service.resolveScope(actor("ADMIN"), "tenant-a", "branch-c")
  );
});

test("SUPER_USER can access an authorized branch but not another tenant", async () => {
  const { service } = createService([]);

  const scope = await service.resolveScope(
    actor("SUPER_USER", { branchId: undefined }),
    "tenant-a",
    "branch-b"
  );
  assert.deepEqual(scope.branchIds, ["branch-b"]);
  await assert.rejects(() =>
    service.resolveScope(actor("SUPER_USER", { branchId: undefined }), "tenant-b")
  );
});

test("fiscal sale deletion is never allowed by this policy", async () => {
  const { service } = createService([]);

  const allowed = await service.canAccessSale(
    actor("ADMIN"),
    { tenantId: "tenant-a", branchId: "branch-a" },
    "DELETE"
  );

  assert.equal(allowed, false);
});
