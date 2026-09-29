import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { CashMovementsService } from "./cash-movements.service";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  branch: "10000000-0000-0000-0000-000000000001",
  otherBranch: "10000000-0000-0000-0000-000000000002",
  register: "20000000-0000-0000-0000-000000000001",
  session: "30000000-0000-0000-0000-000000000001",
};

const actor = (role: string) => ({
  userId: "40000000-0000-0000-0000-000000000001",
  tenantId: ids.tenant,
  roles: [role],
});

const session = (overrides: Record<string, unknown> = {}) => ({
  id: ids.session,
  tenant_id: ids.tenant,
  branch_id: ids.branch,
  cash_register_id: ids.register,
  opened_by_user_id: actor("USER").userId,
  status: "OPEN",
  ...overrides,
});

const buildService = (overrides: Record<string, unknown> = {}) => {
  const repository = {
    list: async () => [],
    ...((overrides.repository as object | undefined) ?? {}),
  };
  const sessionsRepository = {
    findById: async () => session(),
    hasActiveAssignment: async () => false,
    ...((overrides.sessionsRepository as object | undefined) ?? {}),
  };
  const accessRepository = {
    findBranchById: async (branchId: string) => ({ id: branchId }),
    userHasBranchAccess: async () => true,
    findAccessibleBranchIds: async () => [ids.branch],
    ...((overrides.accessRepository as object | undefined) ?? {}),
  };
  const paymentsRepository = {
    summarizeByPaymentMethodForFilters: async () => [],
  };
  return new CashMovementsService(
    repository as never,
    sessionsRepository as never,
    { findById: async () => ({ id: ids.register, branch_id: ids.branch, activo: true }) } as never,
    paymentsRepository as never,
    accessRepository as never,
    {} as never,
    {} as never,
  );
};

test("CashMovementsService: ADMIN no puede ampliar a otra sucursal", async () => {
  const service = buildService({
    accessRepository: {
      userHasBranchAccess: async () => false,
    },
  });

  await assert.rejects(
    () => service.list({ dateFrom: "2026-09-01", dateTo: "2026-09-01", branchId: ids.otherBranch }, actor("ADMIN") as never),
    ForbiddenException,
  );
});

test("CashMovementsService: Turno actual exige sesión abierta y conserva cashSessionId", async () => {
  let received: Record<string, unknown> | undefined;
  const service = buildService({
    repository: {
      list: async (filters: Record<string, unknown>) => {
        received = filters;
        return [];
      },
    },
  });

  await service.list({ cashSessionId: ids.session, includeSummary: true }, actor("ADMIN") as never);
  assert.equal(received?.cashSessionId, ids.session);
  assert.equal(received?.dateFrom, undefined);
  assert.equal(received?.dateTo, undefined);
});

test("CashMovementsService: Turno actual rechaza sesión cerrada", async () => {
  const service = buildService({
    sessionsRepository: {
      findById: async () => session({ status: "CLOSED" }),
    },
  });

  await assert.rejects(
    () => service.list({ cashSessionId: ids.session }, actor("ADMIN") as never),
    BadRequestException,
  );
});
