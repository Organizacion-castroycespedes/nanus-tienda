import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { TerminalsService } from "./terminals.service";

const qaTenant = "00000000-0000-0000-0000-000000000001";
const branch = "ab41d3da-6686-4de3-9191-875a5a7da5a5";

const buildService = (options: { branchValid?: boolean; slugError?: Error } = {}) => {
  const repository = {
    validateBranch: async () => options.branchValid ?? true,
    findByBranch: async (tenantId: string, branchId?: string) => [{ tenantId, branchId }],
  };
  const accessControl = {
    resolveTenantIdFromSlug: async () => {
      if (options.slugError) throw options.slugError;
      return qaTenant;
    },
  };
  return new TerminalsService(
    repository as never,
    { query: async () => ({ rows: [] }) } as never,
    { logEvent: () => undefined } as never,
    accessControl as never,
  );
};

describe("TerminalsService tenant request resolution", () => {
  it("keeps the QA all-zero UUID as an ID, not a slug", async () => {
    const result = await buildService().listTerminals(
      { tenantId: qaTenant, branchId: branch },
      { roles: ["SUPER_ADMIN"], tenantId: qaTenant },
    );
    assert.equal(result[0]?.tenantId, qaTenant);
  });

  it("preserves normal UUID and slug resolution", async () => {
    const service = buildService();
    const uuidResult = await service.listTerminals(
      { tenantId: "550e8400-e29b-41d4-a716-446655440000" },
      { roles: ["SUPER_ADMIN"], tenantId: qaTenant },
    );
    const slugResult = await service.listTerminals(
      { tenantId: "qa-tenant" },
      { roles: ["SUPER_ADMIN"], tenantId: qaTenant },
    );
    assert.equal(uuidResult[0]?.tenantId, "550e8400-e29b-41d4-a716-446655440000");
    assert.equal(slugResult[0]?.tenantId, qaTenant);
  });

  it("rejects a missing slug and a tenant outside a scoped actor", async () => {
    await assert.rejects(
      () => buildService({ slugError: new NotFoundException("Tenant no encontrado") }).listTerminals(
        { tenantId: "missing-tenant" },
        { roles: ["SUPER_ADMIN"], tenantId: qaTenant },
      ),
      NotFoundException,
    );
    await assert.rejects(
      () => buildService().listTerminals(
        { tenantId: "550e8400-e29b-41d4-a716-446655440000" },
        { roles: ["SUPER_USER"], tenantId: qaTenant },
      ),
      ForbiddenException,
    );
  });

  it("rejects a branch outside the resolved tenant", async () => {
    await assert.rejects(
      () => buildService({ branchValid: false }).listTerminals(
        { tenantId: qaTenant, branchId: branch },
        { roles: ["SUPER_ADMIN"], tenantId: qaTenant },
      ),
      BadRequestException,
    );
  });
});
