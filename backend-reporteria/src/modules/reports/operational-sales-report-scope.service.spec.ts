import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { OperationalSalesReportScopeService } from "./operational-sales-report-scope.service";
import type { ReportUser } from "../auth/report-auth.types";

const user: ReportUser = {
  id: "10000000-0000-0000-0000-000000000001",
  tenantId: "20000000-0000-0000-0000-000000000001",
  roles: ["USER"],
  branchId: null,
  sessionId: "30000000-0000-0000-0000-000000000001",
};

test("operational report USER scope requires POS session and one current OPEN cash session", async () => {
  const calls: string[] = [];
  const db = {
    query: async (sql: string) => {
      calls.push(sql);
      if (calls.length === 1) return { rowCount: 1, rows: [{}] };
      if (calls.length === 2) {
        return {
          rowCount: 1,
          rows: [
            {
              branch_id: "40000000-0000-0000-0000-000000000001",
              terminal_id: "80000000-0000-0000-0000-000000000001",
            },
          ],
        };
      }
      assert.match(sql, /cash_register_user_assignments/);
      assert.match(sql, /opened_by_user_id/);
      return {
        rowCount: 1,
        rows: [{ id: "50000000-0000-0000-0000-000000000001" }],
      };
    },
  };
  const scope = await new OperationalSalesReportScopeService(db as never).resolve(
    user,
    {},
    "60000000-0000-0000-0000-000000000001"
  );
  assert.deepEqual(scope, {
    tenantId: user.tenantId,
    branchIds: ["40000000-0000-0000-0000-000000000001"],
    userId: user.id,
    cashSessionId: "50000000-0000-0000-0000-000000000001",
    requiresCurrentShift: true,
  });
});

test("operational report USER cannot widen branch or cash session", async () => {
  const db = {
    query: async (sql: string) =>
      sql.includes("user_roles")
        ? { rowCount: 1, rows: [{}] }
        : {
            rowCount: 1,
            rows: [
              {
                branch_id: "40000000-0000-0000-0000-000000000001",
                terminal_id: null,
              },
            ],
          },
  };
  const service = new OperationalSalesReportScopeService(db as never);
  const resolved = await service.resolve(
    user,
    { branchId: "70000000-0000-0000-0000-000000000001" },
    "60000000-0000-0000-0000-000000000001"
  );
  assert.deepEqual(resolved.branchIds, []);
});

test("operational report USER fails clearly when no open assigned cash session", async () => {
  const calls: string[] = [];
  const db = {
    query: async () => {
      calls.push("q");
      if (calls.length === 1) return { rowCount: 1, rows: [{}] };
      if (calls.length === 2) {
        return {
          rowCount: 1,
          rows: [
            {
              branch_id: "40000000-0000-0000-0000-000000000001",
              terminal_id: null,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  await assert.rejects(
    () =>
      new OperationalSalesReportScopeService(db as never).resolve(
        user,
        {},
        "60000000-0000-0000-0000-000000000001"
      ),
    (error: unknown) =>
      error instanceof ForbiddenException &&
      String(error.message).includes("No hay una caja abierta")
  );
});
