import test from "node:test";
import assert from "node:assert/strict";
import { OperationalSalesReportScopeService } from "./operational-sales-report-scope.service";
import type { ReportUser } from "../auth/report-auth.types";

const user: ReportUser = { id: "10000000-0000-0000-0000-000000000001", tenantId: "20000000-0000-0000-0000-000000000001", roles: ["USER"], branchId: null, sessionId: "30000000-0000-0000-0000-000000000001" };

test("operational report USER scope requires POS session and one current OPEN cash session", async () => {
  const calls: string[] = [];
  const db = { query: async (sql: string) => { calls.push(sql); if (calls.length === 1) return { rowCount: 1, rows: [{}] }; if (calls.length === 2) return { rowCount: 1, rows: [{ branch_id: "40000000-0000-0000-0000-000000000001" }] }; return { rowCount: 1, rows: [{ id: "50000000-0000-0000-0000-000000000001" }] }; } };
  const scope = await new OperationalSalesReportScopeService(db as never).resolve(user, {}, "60000000-0000-0000-0000-000000000001");
  assert.deepEqual(scope, { tenantId: user.tenantId, branchIds: ["40000000-0000-0000-0000-000000000001"], userId: user.id, cashSessionId: "50000000-0000-0000-0000-000000000001", requiresCurrentShift: true });
});

test("operational report USER cannot widen branch or cash session", async () => {
  const db = { query: async (sql: string) => sql.includes("user_roles") ? { rowCount: 1, rows: [{}] } : { rowCount: 1, rows: [{ branch_id: "40000000-0000-0000-0000-000000000001" }] } };
  const service = new OperationalSalesReportScopeService(db as never);
  const resolved = await service.resolve(user, { branchId: "70000000-0000-0000-0000-000000000001" }, "60000000-0000-0000-0000-000000000001");
  assert.deepEqual(resolved.branchIds, []);
});
