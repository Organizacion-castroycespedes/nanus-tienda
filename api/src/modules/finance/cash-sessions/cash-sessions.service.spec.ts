import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { CashSessionsService } from "./cash-sessions.service";

const tenantId = "00000000-0000-0000-0000-000000000001";
const branchId = "branch-001";
const cashSessionId = "cash-session-001";
const userId = "user-001";

const actor = {
  userId,
  tenantId,
  roles: ["SUPER_ADMIN"],
};

const buildRecord = (overrides: Record<string, unknown> = {}) => ({
  id: cashSessionId,
  tenant_id: tenantId,
  branch_id: branchId,
  cash_register_id: "register-001",
  cash_register_codigo: "CAJA-1",
  cash_register_nombre: "Caja 1",
  opened_by_user_id: userId,
  opened_by_user_email: "admin@example.com",
  closed_by_user_id: null,
  closed_by_user_email: null,
  opened_at: "2026-06-11T20:00:00.000Z",
  closed_at: null,
  opening_amount: "100000",
  closing_amount: null,
  expected_amount: null,
  difference_amount: null,
  status: "OPEN",
  created_at: "2026-06-11T20:00:00.000Z",
  ...overrides,
});

const buildSummary = (expectedAmount: number) => ({
  sessionId: cashSessionId,
  tenantId,
  branchId,
  cashRegisterId: "register-001",
  cashRegisterCodigo: "CAJA-1",
  cashRegisterNombre: "Caja 1",
  terminalId: null,
  terminalName: null,
  openedByUserId: userId,
  openedByUserEmail: "admin@example.com",
  closedByUserId: null,
  closedByUserEmail: null,
  openedAt: "2026-06-11T20:00:00.000Z",
  closedAt: null,
  status: "OPEN",
  totals: {
    openingAmount: 100000,
    paymentsIn: 0,
    paymentsOut: 0,
    expenses: 0,
    withdrawals: 0,
    adjustmentsIn: 0,
    adjustmentsOut: 0,
    closingRecorded: 0,
    salesPayments: 0,
    purchasePayments: 0,
    refundPayments: 0,
    expectedAmount,
    netAmount: expectedAmount,
    movementCount: 0,
    paymentCount: 0,
  },
  paymentBreakdown: [],
  movementBreakdown: [],
  recentMovements: [],
  lastCount: null,
});

const buildHarness = (
  expectedAmount: number,
  options: { branchAccess?: boolean } = {}
) => {
  const queries: string[] = [];
  let released = false;
  let closeInput: Record<string, unknown> | null = null;
  let openInput: Record<string, unknown> | null = null;
  let cashCountInput: Record<string, unknown> | null = null;
  let movementInput: Record<string, unknown> | null = null;

  const client = {
    query: async (query: string) => {
      queries.push(query);
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };

  const repository = {
    findOpenByRegister: async () => null,
    findCurrentByUser: async () => null,
    findById: async () => buildRecord(),
    create: async (
      _client: unknown,
      data: Record<string, unknown>
    ) => {
      openInput = data;
      return buildRecord({
        branch_id: data.branchId,
        cash_register_id: data.cashRegisterId,
        opening_amount: String(data.openingAmount),
      });
    },
    getSummary: async () => buildSummary(expectedAmount),
    close: async (
      _client: unknown,
      _cashSessionId: string,
      data: Record<string, unknown>
    ) => {
      closeInput = data;
      return buildRecord({
        closed_by_user_id: data.closedByUserId,
        closed_at: data.closedAt,
        closing_amount: String(data.closingAmount),
        expected_amount: String(data.expectedAmount),
        difference_amount: String(data.differenceAmount),
        status: data.status,
      });
    },
    createCashCount: async (_client: unknown, data: Record<string, unknown>) => {
      cashCountInput = data;
    },
  };

  const cashMovementsRepository = {
    create: async (_client: unknown, data: Record<string, unknown>) => {
      movementInput = data;
    },
  };

  const cashRegistersRepository = {
    findById: async () => ({
      id: "register-001",
      tenant_id: tenantId,
      branch_id: branchId,
      codigo: "CAJA-1",
      nombre: "Caja 1",
      activo: true,
    }),
  };

  const accessRepository = {
    findUserById: async () => ({
      id: userId,
      tenant_id: tenantId,
      email: "admin@example.com",
      estado: "ACTIVE",
    }),
    findBranchById: async () => ({
      id: branchId,
      tenant_id: tenantId,
      nombre: "Principal",
      codigo: "P",
      estado: "ACTIVE",
    }),
    userHasBranchAccess: async () => options.branchAccess ?? true,
  };

  const db = {
    getClient: async () => client,
  };

  const auditService = {
    logEvent: () => undefined,
  };

  const service = new CashSessionsService(
    repository as never,
    cashRegistersRepository as never,
    cashMovementsRepository as never,
    accessRepository as never,
    db as never,
    auditService as never
  );

  return {
    service,
    getOpenInput: () => openInput,
    getCloseInput: () => closeInput,
    getCashCountInput: () => cashCountInput,
    getMovementInput: () => movementInput,
    getQueries: () => queries,
    wasReleased: () => released,
  };
};

test("close normalizes negative expected amount before persistence", async () => {
  const harness = buildHarness(-15000);

  const response = await harness.service.close(
    cashSessionId,
    {
      closingAmount: 219000,
      description: "",
    },
    actor
  );

  assert.equal(harness.getCloseInput()?.expectedAmount, 0);
  assert.equal(harness.getCloseInput()?.differenceAmount, 219000);
  assert.equal(harness.getCashCountInput()?.expectedAmount, 0);
  assert.equal(harness.getCashCountInput()?.differenceAmount, 219000);
  assert.equal(harness.getMovementInput()?.movementType, "CLOSING");
  assert.equal(harness.getMovementInput()?.amount, 219000);
  assert.deepEqual(harness.getQueries(), ["BEGIN", "COMMIT"]);
  assert.equal(harness.wasReleased(), true);
  assert.equal(response.expectedAmount, 0);
  assert.equal(response.differenceAmount, 219000);
});

test("close keeps non-negative expected amount unchanged", async () => {
  const harness = buildHarness(123456.78);

  await harness.service.close(
    cashSessionId,
    {
      closingAmount: 219000,
      description: "Cierre",
    },
    actor
  );

  assert.equal(harness.getCloseInput()?.expectedAmount, 123456.78);
  assert.equal(harness.getCloseInput()?.differenceAmount, 95543.22);
  assert.equal(harness.getCashCountInput()?.expectedAmount, 123456.78);
  assert.equal(harness.getCashCountInput()?.differenceAmount, 95543.22);
  assert.deepEqual(harness.getQueries(), ["BEGIN", "COMMIT"]);
  assert.equal(harness.wasReleased(), true);
});

test("close with zero amount skips invalid closing cash movement insert", async () => {
  const harness = buildHarness(0);

  const response = await harness.service.close(
    cashSessionId,
    {
      closingAmount: 0,
      description: "Sin efectivo",
    },
    actor
  );

  assert.equal(harness.getCloseInput()?.expectedAmount, 0);
  assert.equal(harness.getCloseInput()?.differenceAmount, 0);
  assert.equal(harness.getCashCountInput()?.countedCashAmount, 0);
  assert.equal(harness.getCashCountInput()?.expectedAmount, 0);
  assert.equal(harness.getCashCountInput()?.differenceAmount, 0);
  assert.equal(harness.getMovementInput(), null);
  assert.deepEqual(harness.getQueries(), ["BEGIN", "COMMIT"]);
  assert.equal(harness.wasReleased(), true);
  assert.equal(response.closingAmount, 0);
  assert.equal(response.expectedAmount, 0);
  assert.equal(response.differenceAmount, 0);
});

test("open with zero amount skips invalid opening cash movement insert", async () => {
  const harness = buildHarness(0);

  const response = await harness.service.open(
    {
      branchId,
      cashRegisterId: "register-001",
      openingAmount: 0,
    },
    actor
  );

  assert.equal(harness.getOpenInput()?.openingAmount, 0);
  assert.equal(harness.getMovementInput(), null);
  assert.deepEqual(harness.getQueries(), ["BEGIN", "COMMIT"]);
  assert.equal(harness.wasReleased(), true);
  assert.equal(response.openingAmount, 0);
});

test("close rejects USER when cash session branch is outside scope", async () => {
  const harness = buildHarness(100000, { branchAccess: false });

  await assert.rejects(
    () =>
      harness.service.close(
        cashSessionId,
        {
          closingAmount: 100000,
          description: "Cierre",
        },
        {
          userId,
          tenantId,
          roles: ["USER"],
        }
      ),
    ForbiddenException
  );

  assert.equal(harness.getCloseInput(), null);
  assert.deepEqual(harness.getQueries(), []);
});
