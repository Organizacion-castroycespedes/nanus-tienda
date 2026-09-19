import assert from "node:assert/strict";
import test from "node:test";
import { ProductInventoryReportsController } from "./product-inventory-reports.controller";
import { ProductInventoryReportsService } from "./product-inventory-reports.service";
import { ForbiddenException } from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";

const user: ReportUser = {
  id: "40000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000001",
  branchId: null,
  roles: ["ADMIN"],
};

test("product inventory endpoint passes filter intent and authenticated actor to one package builder", async () => {
  const calls: unknown[][] = [];
  const service = {
    createPreviewPackage: async (...args: unknown[]) => {
      calls.push(args);
      return { dataset: { rows: [] }, pdfBase64: "" };
    },
    createPackage: async (...args: unknown[]) => {
      calls.push(args);
      return { dataset: { rows: [] }, pdfBase64: "", xlsxBase64: "" };
    },
  };
  const controller = new ProductInventoryReportsController(service as any);
  const result = await controller.getReport({ branchId: "30000000-0000-4000-8000-000000000001" },
    { user } as any);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [{ branchId: "30000000-0000-4000-8000-000000000001" }, user]);
  assert.deepEqual(result.dataset.rows, []);
});

test("endpoint with real report service preserves ADMIN A/C and denies B before function call", async () => {
  const branchA = "30000000-0000-4000-8000-000000000001";
  const branchC = "30000000-0000-4000-8000-000000000003";
  const branchB = "30000000-0000-4000-8000-000000000002";
  const calls: unknown[][] = [];
  const scope = { resolve: async (_user: ReportUser, branch?: string) => {
    if (branch && ![branchA, branchC].includes(branch)) throw new ForbiddenException();
    return { tenantId: user.tenantId, branchIds: branch ? [branch] : [branchA, branchC] };
  } };
  const db = { query: async (sql: string, params: unknown[]) => {
    if (sql.includes("fnc_report_product_inventory")) {
      calls.push(params);
      return { rows: [] };
    }
    return { rows: [{ name: "Empresa", legal_name: null, nit: null,
      address: null, phone: null, config: null }] };
  } };
  const pdf = { generatePdf: async () => Buffer.from("pdf") };
  const service = new ProductInventoryReportsService(scope as any, db as any, pdf as any);
  const controller = new ProductInventoryReportsController(service);
  await controller.getReport({}, { user } as any);
  assert.deepEqual(calls[0][1], [branchA, branchC]);
  await assert.rejects(controller.getReport({ branchId: branchB }, { user } as any), ForbiddenException);
  assert.equal(calls.length, 1);
});
