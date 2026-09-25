import assert from "node:assert/strict";
import test from "node:test";
import { getReportRoles } from "../auth/report-roles.decorator";
import { SalesReportsController } from "./sales-reports.controller";

test("SalesReportsController: POS sale ticket permite roles operativos", () => {
  assert.deepEqual(
    getReportRoles(SalesReportsController.prototype.getSaleTicket),
    ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]
  );
});

test("SalesReportsController: listado y cancelación permiten roles operativos", () => {
  assert.deepEqual(
    getReportRoles(SalesReportsController.prototype.getSalesList),
    ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]
  );
  assert.deepEqual(
    getReportRoles(SalesReportsController.prototype.getSaleCancelTicket),
    ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]
  );
});

test("SalesReportsController: xlsx uses the server document exporter", async () => {
  let excelCalls = 0;
  const body = Buffer.from("xlsx");
  const headers = new Map<string, string | number>();
  let sent: Buffer | undefined;
  const controller = new SalesReportsController({
    getSalesListExcel: async () => { excelCalls += 1; return body; },
    getSalesListPdf: async () => Buffer.from("pdf"),
  } as never);

  await controller.getSalesList(
    { format: "xlsx", tenantId: "tenant-1" },
    { user: { id: "user-1", tenantId: "tenant-1", roles: ["USER"] } } as never,
    {
      setHeader: (name: string, value: string | number) => { headers.set(name, value); },
      end: (value: Buffer) => { sent = value; },
      json: () => undefined,
    } as never,
  );

  assert.equal(excelCalls, 1);
  assert.equal(sent, body);
  assert.equal(headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.match(String(headers.get("Content-Disposition")), /reporte-ventas-pos\.xlsx/);
});
