import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { ProductInventoryReportsService } from "./product-inventory-reports.service";
import type { ReportUser } from "../auth/report-auth.types";

const tenantId = "00000000-0000-4000-8000-000000000001";
const userId = "40000000-0000-4000-8000-000000000001";
const branchA = "30000000-0000-4000-8000-000000000001";
const branchB = "30000000-0000-4000-8000-000000000002";
const branchC = "30000000-0000-4000-8000-000000000003";
const user: ReportUser = { id: userId, tenantId, roles: ["ADMIN"], branchId: null };

const row = {
  product_id: "20000000-0000-4000-8000-000000000001", product_name: "Producto",
  sku: "SKU-1", category_id: null, category_name: null, subcategory_id: null,
  subcategory_name: null, unit_id: "10000000-0000-4000-8000-000000000001",
  unit_name: "Unidad", unit_abbreviation: "UND", sale_type: "UNIT",
  measurement_unit: "UND", operational_status: "ACTIVE", branch_id: branchA,
  branch_name: "A", price: "120.00", catalog_cost: "80.00", stock: "7.00",
  min_stock: "2.00", max_stock: null, stock_state: "AVAILABLE",
  primary_code: "123", assigned_codes: ["123", "456"], requires_lot: true,
  requires_expiration: true, lot_id: null, lot_code: null, lot_status: null,
  lot_unit_cost: null, expiration_date: null, days_to_expiration: null,
  quantity_on_hand: null, quantity_reserved: null, quantity_available: null,
  location_id: null, location_code: null, location_name: null,
  total_rows: 1,
};

const createService = (options: { rows?: typeof row[]; authorized?: string[] } = {}) => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const authorized = options.authorized ?? [branchA, branchC];
  const scope = {
    resolve: async (_user: ReportUser, branchId?: string, requestedTenant?: string) => {
      if (requestedTenant && requestedTenant !== tenantId) throw new ForbiddenException();
      if (branchId && !authorized.includes(branchId)) throw new ForbiddenException();
      return { tenantId, branchIds: branchId ? [branchId] : authorized };
    },
  };
  const db = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return sql.includes("fnc_report_product_inventory")
        ? { rows: options.rows ?? [row] }
        : { rows: [{ name: "Tienda", legal_name: "Tienda SAS", nit: "123",
          address: null, phone: null, config: { colors: { primary: "#234567" } } }] };
    },
  };
  (db as any).getClient = async () => ({
    query: db.query,
    release: () => undefined,
  });
  const pdf = { generatePdf: async () => Buffer.from("pdf-test") };
  return { service: new ProductInventoryReportsService(scope as any, db as any, pdf as any), calls };
};

test("ADMIN A/C with no filter sends exactly A/C to sole business-data function", async () => {
  const { service, calls } = createService();
  const result = await service.getDataset({ categoryId: "60000000-0000-4000-8000-000000000001" }, user);
  assert.deepEqual(result.branchIds, [branchA, branchC]);
  assert.deepEqual(calls[0].params.slice(0, 2), [tenantId, [branchA, branchC]]);
  assert.equal(calls[0].params[6], "60000000-0000-4000-8000-000000000001");
  assert.match(calls[0].sql, /SELECT \* FROM public\.fnc_report_product_inventory/);
  assert.equal(calls.filter((call) => call.sql.includes("fnc_report_product_inventory")).length, 1);
  assert.equal(result.rows[0].catalogCost, 80);
  assert.deepEqual(result.rows[0].assignedCodes, ["123", "456"]);
});

test("authorized C narrows function array; unauthorized B never calls SQL", async () => {
  const { service, calls } = createService();
  await service.getDataset({ branchId: branchC }, user);
  assert.deepEqual(calls[0].params[1], [branchC]);
  calls.length = 0;
  await assert.rejects(service.getDataset({ branchId: branchB }, user), ForbiddenException);
  assert.equal(calls.length, 0);
});

test("cross-tenant and invalid filters never call SQL", async () => {
  const { service, calls } = createService();
  await assert.rejects(service.getDataset({ tenantId: "00000000-0000-4000-8000-000000000002" }, user), ForbiddenException);
  await assert.rejects(service.getDataset({ categoryId: "bad" }, user), BadRequestException);
  await assert.rejects(service.getDataset({ stockState: "INVENTED" }, user), BadRequestException);
  await assert.rejects(service.getDataset({ unexpected: "1" }, user), BadRequestException);
  await assert.rejects(service.getDataset({ expirationFrom: "2026-02-30" }, user), BadRequestException);
  assert.equal(calls.length, 0);
});

test("pagination is bounded and reaches the typed LIMIT/OFFSET parameters", async () => {
  const { service, calls } = createService();
  await service.getDataset({ page: "2", pageSize: "50" }, user);
  assert.equal(calls[0].params[21], 50);
  assert.equal(calls[0].params[22], 50);
  await assert.rejects(service.getDataset({ page: "0" }, user), BadRequestException);
  await assert.rejects(service.getDataset({ pageSize: "501" }, user), BadRequestException);
});

test("category, subcategory, unit and expiration filters retain typed function positions", async () => {
  const { service, calls } = createService();
  const categoryId = "60000000-0000-4000-8000-000000000001";
  const subcategoryId = "70000000-0000-4000-8000-000000000001";
  const unitId = "10000000-0000-4000-8000-000000000001";
  await service.getDataset({ categoryId, subcategoryId, unitId,
    expirationFrom: "2026-09-01", expirationTo: "2026-09-30", expiredOnly: "true" }, user);
  assert.deepEqual(calls[0].params.slice(6, 9), [categoryId, subcategoryId, unitId]);
  assert.deepEqual(calls[0].params.slice(17, 20), ["2026-09-01", "2026-09-30", true]);
});

test("empty results retain authorized scope and produce no invented rows", async () => {
  const { service } = createService({ rows: [] });
  const result = await service.getDataset({}, user);
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.branchIds, [branchA, branchC]);
});

test("preview package derives PDF and typed XLSX from one function result", async () => {
  const { service, calls } = createService();
  const report = await service.createPackage({}, user);
  assert.equal(calls.filter((call) => call.sql.includes("fnc_report_product_inventory")).length, 1);
  assert.equal(Buffer.from(report.pdfBase64, "base64").toString(), "pdf-test");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(report.xlsxBase64, "base64"));
  const sheet = workbook.getWorksheet("Productos Inventario")!;
  assert.equal(sheet.getRow(2).getCell(9).value, 120);
  assert.equal(sheet.getRow(2).getCell(10).value, 80);
  assert.equal(sheet.getRow(2).getCell(11).value, 7);
  assert.equal(sheet.views[0].state, "frozen");
  assert.ok(sheet.autoFilter);
});
