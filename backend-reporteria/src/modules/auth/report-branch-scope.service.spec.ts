import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { ReportBranchScopeService } from "./report-branch-scope.service";
import type { ReportUser } from "./report-auth.types";

const TENANT_A = "00000000-0000-4000-8000-000000000001";
const TENANT_B = "00000000-0000-4000-8000-000000000002";
const USER = "40000000-0000-4000-8000-000000000001";
const A = "30000000-0000-4000-8000-000000000001";
const B = "30000000-0000-4000-8000-000000000002";
const C = "30000000-0000-4000-8000-000000000003";

const actor = (roles: string[], overrides: Partial<ReportUser> = {}): ReportUser => ({
  id: USER,
  tenantId: TENANT_A,
  branchId: null,
  roles,
  ...overrides,
});

const createService = (branchIds: string[]) => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rows: branchIds.map((branch_id) => ({ branch_id })) };
    },
  };
  return { service: new ReportBranchScopeService(db as any), calls };
};

test("ADMIN single assignment and no filter stays in one branch", async () => {
  const { service, calls } = createService([A]);
  assert.deepEqual(await service.resolve(actor(["ADMIN"])), {
    tenantId: TENANT_A,
    branchIds: [A],
  });
  assert.deepEqual(calls[0].params, [USER, TENANT_A]);
});

test("ADMIN multiple assignments and no filter keeps exactly A and C", async () => {
  const { service, calls } = createService([A, C, A]);
  assert.deepEqual((await service.resolve(actor(["ADMIN"]))).branchIds, [A, C]);
  const sql = calls[0].sql;
  assert.match(sql, /INNER JOIN public\.personas/);
  assert.match(sql, /INNER JOIN public\.persona_tenant_branches/);
  assert.match(sql, /ptb\.tenant_id = u\.tenant_id/);
  assert.match(sql, /b\.tenant_id = ptb\.tenant_id/);
  assert.match(sql, /u\.id = \$1 AND u\.tenant_id = \$2/);
  assert.match(sql, /u\.estado = 'ACTIVE' AND b\.estado = 'ACTIVE'/);
});

test("ADMIN multiple assignments may narrow to C", async () => {
  const { service } = createService([A, C]);
  assert.deepEqual((await service.resolve(actor(["ADMIN"]), C)).branchIds, [C]);
});

test("ADMIN requested B cannot expand A and C", async () => {
  const { service } = createService([A, C]);
  await assert.rejects(service.resolve(actor(["ADMIN"]), B), ForbiddenException);
});

test("a client-supplied branch claim cannot expand ADMIN assignments", async () => {
  const { service } = createService([A, C]);
  const forged = actor(["ADMIN"], { branchId: B });
  assert.deepEqual((await service.resolve(forged)).branchIds, [A, C]);
  await assert.rejects(service.resolve(forged, B), ForbiddenException);
});

test("ADMIN cross-tenant request is denied before querying assignments", async () => {
  const { service, calls } = createService([A]);
  await assert.rejects(service.resolve(actor(["ADMIN"]), null, TENANT_B), ForbiddenException);
  assert.equal(calls.length, 0);
});

test("cross-tenant branch is denied even for tenant-wide role", async () => {
  const { service, calls } = createService([A, C]);
  await assert.rejects(service.resolve(actor(["SUPER_USER"]), B), ForbiddenException);
  assert.deepEqual(calls[0].params, [USER, TENANT_A, TENANT_A]);
  assert.match(calls[0].sql, /b\.tenant_id = \$2/);
});

test("ADMIN with no persona or assignments fails closed", async () => {
  const { service } = createService([]);
  await assert.rejects(service.resolve(actor(["ADMIN"])), ForbiddenException);
});

test("SUPER_USER receives active branches only in own tenant", async () => {
  const { service, calls } = createService([A, C]);
  assert.deepEqual((await service.resolve(actor(["SUPER_USER"]))).branchIds, [A, C]);
  assert.deepEqual(calls[0].params, [USER, TENANT_A, TENANT_A]);
  assert.match(calls[0].sql, /b\.estado = 'ACTIVE'/);
});

test("SUPER_ADMIN can select another tenant's active branches explicitly", async () => {
  const { service, calls } = createService([B]);
  assert.deepEqual(await service.resolve(actor(["SUPER_ADMIN"]), null, TENANT_B), {
    tenantId: TENANT_B,
    branchIds: [B],
  });
  assert.deepEqual(calls[0].params, [USER, TENANT_B, TENANT_A]);
});

test("missing user identity and invalid client branch fail closed", async () => {
  const { service, calls } = createService([A]);
  await assert.rejects(service.resolve(undefined), ForbiddenException);
  await assert.rejects(service.resolve(actor(["ADMIN"]), "not-a-uuid"), ForbiddenException);
  await assert.rejects(service.resolve(actor([])), ForbiddenException);
  assert.equal(calls.length, 0);
});
