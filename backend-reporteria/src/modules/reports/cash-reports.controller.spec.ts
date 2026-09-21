import assert from "node:assert/strict";
import test from "node:test";
import { getReportRoles } from "../auth/report-roles.decorator";
import { CashReportsController } from "./cash-reports.controller";

test("CashReportsController: cash closing ticket permite USER con scope SQL", () => {
  assert.deepEqual(
    getReportRoles(CashReportsController.prototype.getCashClosingTicket),
    ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]
  );
});

test("CashReportsController: Caja selecciona PDF/XLSX por tab endpoint", async () => {
  const calls: string[] = [];
  const headers = new Map<string, string | number>();
  const sent: Buffer[] = [];
  const controller = new CashReportsController({
    getCashClosingsPdf: async () => { calls.push("closing-pdf"); return Buffer.from("pdf"); },
    getCashClosingsExcel: async () => { calls.push("closing-xlsx"); return Buffer.from("xlsx"); },
    getCashAuditsPdf: async () => { calls.push("audit-pdf"); return Buffer.from("pdf"); },
    getCashAuditsExcel: async () => { calls.push("audit-xlsx"); return Buffer.from("xlsx"); },
  } as never);
  const response = {
    setHeader: (name: string, value: string | number) => headers.set(name, value),
    end: (value: Buffer) => { sent.push(value); },
    json: () => undefined,
  } as never;
  const request = { user: { id: "user-1", tenantId: "tenant-1", roles: ["USER"] } } as never;

  await controller.getCashClosings({ format: "xlsx", tenantId: "tenant-1" }, request, response);
  await controller.getCashAudits({ format: "pdf", tenantId: "tenant-1" }, request, response);

  assert.deepEqual(calls, ["closing-xlsx", "audit-pdf"]);
  assert.equal(sent.length, 2);
  assert.equal(headers.get("Content-Length"), 3);
});
