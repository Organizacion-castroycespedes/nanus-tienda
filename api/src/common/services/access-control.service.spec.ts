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
