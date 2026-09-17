import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { TenantsController } from "./tenants.controller";

const tenantId = "00000000-0000-4000-8000-000000000001";
const actor = { tenantId, roles: ["ADMIN"] };

const buildController = (rows: Array<{ id: string; slug: string }> = [{ id: tenantId, slug: "manustienda-platform-s-a-s" }]) => {
  const calls: Array<{ method: string; value: string }> = [];
  const accessControl = {
    resolveTenantIdFromRoute: async (_actor: unknown, routeTenant: string) => {
      const tenant = rows.find((row) => row.slug === routeTenant || row.id === routeTenant);
      if (!tenant) throw new NotFoundException("Tenant no encontrado");
      if (tenant.id !== tenantId) throw new ForbiddenException("Tenant scope mismatch");
      calls.push({ method: "resolve", value: tenant.id });
      return tenant.id;
    },
  };
  const tenantsService = {
    getConfig: async (id: string) => { calls.push({ method: "config", value: id }); return { id }; },
    getDetails: async (id: string) => { calls.push({ method: "details", value: id }); return { tenant_id: id }; },
  };
  return { controller: new TenantsController(tenantsService as any, accessControl as any), calls };
};

test("tenant details and config resolve slug before service calls", async () => {
  const { controller, calls } = buildController();
  assert.deepEqual(await controller.getDetails("manustienda-platform-s-a-s", { user: actor } as any), { tenant_id: tenantId });
  assert.deepEqual(await controller.getConfig("manustienda-platform-s-a-s", { user: actor } as any), { id: tenantId });
  assert.deepEqual(calls, [
    { method: "resolve", value: tenantId },
    { method: "details", value: tenantId },
    { method: "resolve", value: tenantId },
    { method: "config", value: tenantId },
  ]);
});

test("tenant route rejects missing and cross-tenant slugs", async () => {
  const missing = buildController([]).controller;
  await assert.rejects(() => missing.getDetails("missing-tenant", { user: actor } as any), /Tenant no encontrado/);

  const other = buildController([{ id: "00000000-0000-4000-8000-000000000002", slug: "other-tenant" }]).controller;
  await assert.rejects(() => other.getConfig("other-tenant", { user: actor } as any), /Tenant scope mismatch/);
});

test("tenant route keeps UUID compatibility", async () => {
  const { controller, calls } = buildController();
  await controller.getDetails(tenantId, { user: actor } as any);
  assert.deepEqual(calls, [
    { method: "resolve", value: tenantId },
    { method: "details", value: tenantId },
  ]);
});
