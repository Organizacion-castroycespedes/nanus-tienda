import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { BranchesService } from "./branches.service";

const createService = () => {
  const repository = {
    list: async (tenantId?: string) => [
      { id: "branch-a", tenant_id: tenantId ?? "tenant-a", nombre: "A" },
      { id: "branch-b", tenant_id: tenantId ?? "tenant-a", nombre: "B" },
    ],
    listByIds: async (tenantId: string, branchIds: string[]) =>
      branchIds.map((id) => ({ id, tenant_id: tenantId, nombre: id })),
    findById: async (branchId: string, tenantId?: string) => ({
      id: branchId,
      tenant_id: tenantId ?? "tenant-a",
      nombre: branchId,
    }),
  };
  const accessControl = {
    getAccessibleBranchIds: async (_actor: unknown, tenantId: string) =>
      tenantId === "tenant-a" ? ["branch-a"] : [],
    canAccessBranch: async (_actor: unknown, tenantId: string, branchId: string) =>
      tenantId === "tenant-a" && branchId === "branch-a",
  };
  const service = new BranchesService(
    repository as any,
    {} as any,
    { logEvent: () => undefined } as any,
    accessControl as any
  );
  return { service, repository };
};

test("BranchesService: SUPER_USER cannot request another tenant", async () => {
  const { service } = createService();

  await assert.rejects(
    () =>
      service.listBranches("tenant-b", {
        userId: "user-1",
        tenantId: "tenant-a",
        roles: ["SUPER_USER"],
      }),
    ForbiddenException
  );
});

test("BranchesService: ADMIN list is limited to assigned branches", async () => {
  const { service } = createService();

  const branches = await service.listBranches(undefined, {
    userId: "user-1",
    tenantId: "tenant-a",
    roles: ["ADMIN"],
  });

  assert.deepEqual(
    branches.map((branch) => branch.id),
    ["branch-a"]
  );
});

test("BranchesService: USER cannot read unassigned branch detail", async () => {
  const { service } = createService();

  await assert.rejects(
    () =>
      service.getBranch("branch-b", {
        userId: "user-1",
        tenantId: "tenant-a",
        roles: ["USER"],
      }),
    ForbiddenException
  );
});
