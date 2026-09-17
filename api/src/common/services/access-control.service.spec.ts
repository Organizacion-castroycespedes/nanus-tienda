import assert from "node:assert/strict";
import test from "node:test";
import { AccessControlService } from "./access-control.service";

const createService = (rowsByQuery: Array<{ match: string; rows: any[] }>) => {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  const db = {
    query: async (text: string, params: unknown[] = []) => {
      calls.push({ text, params });
      const entry = rowsByQuery.find((item) => text.includes(item.match));
      return { rows: entry?.rows ?? [] };
    },
  };
  return {
    service: new AccessControlService(db as any),
    calls,
  };
};

test("AccessControlService: SUPER_ADMIN can access any tenant", () => {
  const { service } = createService([]);

  assert.equal(
    service.canAccessTenant(
      { id: "user-1", tenantId: "tenant-a", roles: ["SUPER_ADMIN"] },
      "tenant-b"
    ),
    true
  );
});

test("AccessControlService: tenant-scoped roles cannot access other tenants", () => {
  const { service } = createService([]);

  assert.equal(
    service.canAccessTenant(
      { id: "user-1", tenantId: "tenant-a", roles: ["SUPER_USER"] },
      "tenant-b"
    ),
    false
  );
  assert.equal(
    service.canAccessTenant(
      { id: "user-1", tenantId: "tenant-a", roles: ["ADMIN"] },
      "tenant-a"
    ),
    true
  );
});

test("AccessControlService: SUPER_USER gets all active branches in own tenant", async () => {
  const { service, calls } = createService([
    { match: "FROM tenant_branches", rows: [{ id: "branch-a" }, { id: "branch-b" }] },
  ]);

  const branchIds = await service.getAccessibleBranchIds(
    { id: "user-1", tenantId: "tenant-a", roles: ["SUPER_USER"] },
    "tenant-a"
  );

  assert.deepEqual(branchIds, ["branch-a", "branch-b"]);
  assert.deepEqual(calls[0].params, ["tenant-a"]);
});

test("AccessControlService: ADMIN gets only assigned branches", async () => {
  const { service, calls } = createService([
    { match: "persona_tenant_branches", rows: [{ branch_id: "branch-a" }] },
  ]);

  const branchIds = await service.getAccessibleBranchIds(
    { id: "user-1", tenantId: "tenant-a", roles: ["ADMIN"] },
    "tenant-a"
  );

  assert.deepEqual(branchIds, ["branch-a"]);
  assert.deepEqual(calls[0].params, ["user-1", "tenant-a"]);
});

test("AccessControlService: USER cannot access unassigned branch", async () => {
  const { service } = createService([{ match: "persona_tenant_branches", rows: [] }]);

  const allowed = await service.canAccessBranch(
    { id: "user-1", tenantId: "tenant-a", roles: ["USER"] },
    "tenant-a",
    "branch-b"
  );

  assert.equal(allowed, false);
});

test("AccessControlService resolves a tenant slug to its canonical UUID", async () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const { service, calls } = createService([
    { match: "FROM tenants", rows: [{ id: tenantId, slug: "manustienda-platform-s-a-s" }] },
  ]);

  const resolved = await service.resolveTenantIdFromSlug(
    { tenantId, roles: ["ADMIN"] },
    "manustienda-platform-s-a-s",
  );

  assert.equal(resolved, tenantId);
  assert.deepEqual(calls[0].params, ["manustienda-platform-s-a-s"]);
});

test("AccessControlService rejects cross-tenant slug resolution", async () => {
  const { service } = createService([
    { match: "FROM tenants", rows: [{ id: "tenant-b", slug: "other-tenant" }] },
  ]);

  await assert.rejects(
    () => service.resolveTenantIdFromSlug(
      { tenantId: "tenant-a", roles: ["ADMIN"] },
      "other-tenant",
    ),
    /Tenant scope mismatch/,
  );
});

test("AccessControlService resolves route UUIDs without weakening scope", async () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const { service, calls } = createService([]);

  assert.equal(
    await service.resolveTenantIdFromRoute({ tenantId, roles: ["ADMIN"] }, tenantId),
    tenantId,
  );
  await assert.rejects(
    () => service.resolveTenantIdFromRoute(
      { tenantId, roles: ["ADMIN"] },
      "00000000-0000-4000-8000-000000000002",
    ),
    /Tenant scope mismatch/,
  );
  assert.equal(calls.length, 0);
});

test("AccessControlService preserves the all-zero-shaped UUID used by the QA tenant", async () => {
  const tenantId = "00000000-0000-0000-0000-000000000001";
  const { service, calls } = createService([]);

  assert.equal(
    await service.resolveTenantIdFromRoute({ tenantId, roles: ["ADMIN"] }, tenantId),
    tenantId,
  );
  assert.equal(calls.length, 0);
});
