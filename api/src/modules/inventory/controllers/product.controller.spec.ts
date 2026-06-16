import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { ProductController } from "./product.controller";

const buildRequest = (roles: string[]) =>
  ({
    user: {
      id: "user-1",
      tenantId: "tenant-1",
      roles,
    },
  }) as any;

test("ProductController: bloquea branch no asignada antes de listar productos", async () => {
  const productService = {
    listProducts: async () => [],
  };
  const accessControl = {
    canAccessBranch: async () => false,
  };
  const controller = new ProductController(productService as any, accessControl as any);

  await assert.rejects(
    () => controller.list("branch-2", buildRequest(["USER"])),
    ForbiddenException
  );
});

test("ProductController: lista productos cuando branch esta autorizada", async () => {
  const productService = {
    listProducts: async (tenantId: string, branchId: string) => [
      { tenantId, branchId },
    ],
  };
  const accessControl = {
    canAccessBranch: async () => true,
  };
  const controller = new ProductController(productService as any, accessControl as any);

  const result = await controller.list("branch-1", buildRequest(["ADMIN"]));

  assert.deepEqual(result, [{ tenantId: "tenant-1", branchId: "branch-1" }]);
});
