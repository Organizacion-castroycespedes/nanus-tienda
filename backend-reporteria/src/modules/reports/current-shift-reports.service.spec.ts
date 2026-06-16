import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { CurrentShiftReportsService } from "./current-shift-reports.service";

const ids = {
  user: "10000000-0000-0000-0000-000000000001",
  otherUser: "10000000-0000-0000-0000-000000000002",
  tenant: "00000000-0000-0000-0000-000000000001",
  otherTenant: "00000000-0000-0000-0000-000000000002",
  branch: "20000000-0000-0000-0000-000000000001",
  otherBranch: "20000000-0000-0000-0000-000000000002",
  register: "30000000-0000-0000-0000-000000000001",
  terminal: "40000000-0000-0000-0000-000000000001",
  session: "50000000-0000-0000-0000-000000000001",
  sale: "60000000-0000-0000-0000-000000000001",
};

const buildSession = (overrides: Record<string, unknown> = {}) => ({
  id: ids.session,
  tenant_id: ids.tenant,
  branch_id: ids.branch,
  branch_name: "Sucursal Principal",
  cash_register_id: ids.register,
  cash_register_name: "Caja Principal",
  cash_register_code: "CAJA-1",
  terminal_id: ids.terminal,
  terminal_name: "Terminal 1",
  opened_by_user_id: ids.user,
  opened_by_user_email: "qa.local@example.test",
  opened_at: "2026-06-15T10:00:00.000Z",
  opening_amount: "10000",
  status: "OPEN",
  ...overrides,
});

class FakeDb {
  sessionRows: unknown[] = [buildSession()];
  summary = {
    totals: {
      openingAmount: 10000,
      paymentsIn: 20000,
      paymentsOut: 0,
      adjustmentsIn: 0,
      adjustmentsOut: 0,
      expenses: 0,
      withdrawals: 0,
      salesPayments: 20000,
      expectedAmount: 30000,
    },
  };
  salesRows: unknown[] = [
    {
      id: ids.sale,
      created_at: "2026-06-15T10:05:00.000Z",
      customer_name: "Cliente QA",
      payment_method: "Efectivo",
      status: "CONFIRMED",
      total: "20000",
      paid_amount: "20000",
    },
  ];

  async query(text: string) {
    if (text.includes("current-shift: session-by-id")) {
      return { rows: this.sessionRows };
    }
    if (text.includes("current-shift: current-session")) {
      return { rows: this.sessionRows };
    }
    if (text.includes("current-shift: summary")) {
      return { rows: [{ summary: this.summary }] };
    }
    if (text.includes("current-shift: sales")) {
      return { rows: this.salesRows };
    }
    if (
      text.includes("current-shift: orders") ||
      text.includes("current-shift: purchases") ||
      text.includes("current-shift: movements") ||
      text.includes("current-shift: cash-count")
    ) {
      return { rows: [] };
    }
    throw new Error(`Unexpected query: ${text}`);
  }
}

const buildService = (db = new FakeDb()) =>
  new CurrentShiftReportsService(db as never);

test("CurrentShiftReportsService: USER consulta caja abierta propia", async () => {
  const service = buildService();

  const response = await service.getCurrentShift(
    { tenantId: ids.tenant },
    {
      id: ids.user,
      tenantId: ids.tenant,
      branchId: ids.branch,
      roles: ["USER"],
    }
  );

  assert.equal(response.hasOpenCashSession, true);
  assert.equal(response.cashSession?.id, ids.session);
  assert.equal(response.tabs.sales.total, 1);
  assert.equal(response.tabs.tickets.rows[0]?.type, "POS_SALE");
});

test("CurrentShiftReportsService: responde controlado si no hay caja abierta", async () => {
  const db = new FakeDb();
  db.sessionRows = [];
  const service = buildService(db);

  const response = await service.getCurrentShift(
    { tenantId: ids.tenant },
    {
      id: ids.user,
      tenantId: ids.tenant,
      branchId: ids.branch,
      roles: ["USER"],
    }
  );

  assert.equal(response.hasOpenCashSession, false);
  assert.match(response.message ?? "", /No hay caja abierta/);
});

test("CurrentShiftReportsService: USER no consulta caja ajena", async () => {
  const db = new FakeDb();
  db.sessionRows = [buildSession({ opened_by_user_id: ids.otherUser })];
  const service = buildService(db);

  await assert.rejects(
    () =>
      service.getCurrentShift(
        { tenantId: ids.tenant, cashSessionId: ids.session },
        {
          id: ids.user,
          tenantId: ids.tenant,
          branchId: ids.branch,
          roles: ["USER"],
        }
      ),
    ForbiddenException
  );
});

test("CurrentShiftReportsService: USER no consulta otro tenant", async () => {
  const service = buildService();

  await assert.rejects(
    () =>
      service.getCurrentShift(
        { tenantId: ids.otherTenant },
        {
          id: ids.user,
          tenantId: ids.tenant,
          branchId: ids.branch,
          roles: ["USER"],
        }
      ),
    ForbiddenException
  );
});

test("CurrentShiftReportsService: ADMIN no consulta otra sucursal", async () => {
  const db = new FakeDb();
  db.sessionRows = [buildSession({ branch_id: ids.otherBranch })];
  const service = buildService(db);

  await assert.rejects(
    () =>
      service.getCurrentShift(
        { tenantId: ids.tenant, cashSessionId: ids.session },
        {
          id: ids.user,
          tenantId: ids.tenant,
          branchId: ids.branch,
          roles: ["ADMIN"],
        }
      ),
    ForbiddenException
  );
});

test("CurrentShiftReportsService: SUPER_USER consulta caja del tenant permitido", async () => {
  const db = new FakeDb();
  db.sessionRows = [buildSession({ opened_by_user_id: ids.otherUser })];
  const service = buildService(db);

  const response = await service.getCurrentShift(
    { tenantId: ids.tenant, cashSessionId: ids.session },
    {
      id: ids.user,
      tenantId: ids.tenant,
      branchId: null,
      roles: ["SUPER_USER"],
    }
  );

  assert.equal(response.hasOpenCashSession, true);
  assert.equal(response.cashSession?.userId, ids.otherUser);
});

test("CurrentShiftReportsService: SUPER_USER no consulta otro tenant", async () => {
  const db = new FakeDb();
  db.sessionRows = [buildSession({ tenant_id: ids.otherTenant })];
  const service = buildService(db);

  await assert.rejects(
    () =>
      service.getCurrentShift(
        { cashSessionId: ids.session },
        {
          id: ids.user,
          tenantId: ids.tenant,
          branchId: null,
          roles: ["SUPER_USER"],
        }
      ),
    ForbiddenException
  );
});
