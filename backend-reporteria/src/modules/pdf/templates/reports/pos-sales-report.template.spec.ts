import assert from "node:assert/strict";
import test from "node:test";
import { buildPosSalesReportLayout } from "./pos-sales-report.template";

const dataset = {
  filters: {
    tenantId: "tenant-id",
    branchId: "branch-id",
    dateFrom: "2026-09-01T00:00:00.000Z",
    dateTo: "2026-09-21T00:00:00.000Z",
    actorRole: "USER",
  },
  summary: { count: 1, total: 100, paid: 90, balance: 10, cancelled: 0, refunded: 0 },
  rows: [{
    saleId: "70000000-0000-0000-0000-000000000001",
    date: "2026-09-20T12:00:00.000Z",
    status: "CONFIRMED",
    customerName: "Cliente QA",
    total: 100,
    paid: 90,
    balance: 10,
    paymentStatus: "PARTIAL",
    branchId: "branch-id",
    branchName: "Principal",
    cashSessionId: null,
    billingStatus: "NO_DOCUMENT" as const,
    billingDocumentNumber: null,
    billingCufe: null,
    billingAcceptedAt: null,
  }],
  branding: {
    tenantName: "Tenant Principal",
    legalName: "Empresa QA S.A.S.",
    nit: "900123456",
    dv: "7",
    taxResponsibilities: null,
    regime: null,
    vatResponsibility: null,
    address: "Calle 1",
    city: "Bogota",
    department: "Cundinamarca",
    country: "Colombia",
    phone: "3000000000",
    email: "qa@example.test",
    website: null,
    logo: null,
    branchName: "Principal",
    branchAddress: null,
    branchCity: null,
    branchDepartment: null,
    branchCountry: null,
    branchPhone: null,
    branchEmail: null,
  },
};

test("POS report PDF is landscape, wide enough, and keeps rows intact", () => {
  const definition = buildPosSalesReportLayout(dataset);
  const table = (definition.content as Array<{ table?: Record<string, unknown> }>).find((item) => item.table)?.table;
  const header = (table?.body as Array<Array<{ text?: string }>>)[0];

  assert.equal(definition.pageOrientation, "landscape");
  assert.equal(table?.headerRows, 1);
  assert.equal(table?.dontBreakRows, true);
  assert.equal(table?.keepWithHeaderRows, 1);
  assert.deepEqual(header.map((cell) => cell.text), [
    "Venta", "Fecha/Hora", "Cliente", "Estado", "Total", "Pagado", "Saldo",
  ]);
  assert.equal((table?.widths as unknown[]).length, 7);
  assert.equal((table?.widths as unknown[]).includes("*"), true);
});

test("POS report PDF uses readable corporate scope names", () => {
  const definition = buildPosSalesReportLayout(dataset);
  const serialized = JSON.stringify(definition);
  assert.match(serialized, /Tenant Principal/);
  assert.match(serialized, /Principal/);
  assert.doesNotMatch(serialized, /Tenant: tenant-id/);
  assert.doesNotMatch(serialized, /Sucursal: branch-id/);
  assert.match(serialized, /70000000/);
  assert.doesNotMatch(serialized, /70000000-0000-0000-0000-000000000001/);
});
