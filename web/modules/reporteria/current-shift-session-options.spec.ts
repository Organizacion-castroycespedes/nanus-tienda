import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCurrentShiftSessionOptionLabel,
  filterCurrentShiftSessions,
  getCurrentShiftSessionCashRegisterLabel,
} from "./current-shift-session-options";
import type { CurrentShiftCashSession } from "./types";

const buildSession = (
  overrides: Partial<CurrentShiftCashSession> = {}
): CurrentShiftCashSession => ({
  id: "50000000-0000-0000-0000-000000000001",
  tenantId: "00000000-0000-0000-0000-000000000001",
  branchId: "20000000-0000-0000-0000-000000000001",
  branchName: "Sucursal Principal",
  cashRegisterId: "30000000-0000-0000-0000-000000000001",
  cashRegisterName: "Caja 2",
  cashRegisterCode: "QA-CJA-MVP013",
  terminalId: "40000000-0000-0000-0000-000000000001",
  terminalName: "Terminal 2",
  userId: "10000000-0000-0000-0000-000000000001",
  userName: "icastror@hotmail.com",
  openedAt: "2026-06-18T17:31:15.346Z",
  openingAmount: 0,
  status: "OPEN",
  ...overrides,
});

test("current shift session option label includes operational context", () => {
  const label = buildCurrentShiftSessionOptionLabel(
    buildSession(),
    () => "2026-06-18 17:31"
  );

  assert.equal(
    label,
    "Sucursal Principal | Terminal 2 | Caja 2 (QA-CJA-MVP013) | Abierta por icastror@hotmail.com | 2026-06-18 17:31"
  );
});

test("current shift cash register label falls back safely", () => {
  assert.equal(
    getCurrentShiftSessionCashRegisterLabel(
      buildSession({ cashRegisterName: null, cashRegisterCode: null })
    ),
    "Caja"
  );
});

test("current shift session filter matches branch terminal register and user", () => {
  const sessions = [
    buildSession(),
    buildSession({
      id: "50000000-0000-0000-0000-000000000002",
      branchName: "Sucursal Norte",
      cashRegisterName: "Caja Norte",
      cashRegisterCode: "NORTE-1",
      terminalName: "Terminal Norte",
      userName: "norte@example.test",
    }),
  ];

  assert.deepEqual(
    filterCurrentShiftSessions(sessions, "norte").map((session) => session.id),
    ["50000000-0000-0000-0000-000000000002"]
  );
  assert.deepEqual(
    filterCurrentShiftSessions(sessions, "icastror").map((session) => session.id),
    ["50000000-0000-0000-0000-000000000001"]
  );
});
