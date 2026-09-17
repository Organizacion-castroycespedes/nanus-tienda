import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { SalesReportAdapter } from "./sales-report.adapter";

function readMigration(fileName: string) {
  const candidates = [
    resolve(process.cwd(), "..", "scripts", "database", "migrations", fileName),
    resolve(process.cwd(), "scripts", "database", "migrations", fileName),
  ];
  const filePath = candidates.find((candidate) => existsSync(candidate));

  if (!filePath) {
    throw new Error(`Migration not found: ${fileName}`);
  }

  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

test("SalesReportAdapter.getSalesList: llama report_pos_sales con firma esperada", async () => {
  const calls: Array<{ name: string; params: unknown[] }> = [];
  const adapter = new SalesReportAdapter({
    executeFunction: async (name: string, params: unknown[]) => {
      calls.push({ name, params });
      return null;
    },
  } as never);

  await adapter.getSalesList(
    {
      userId: "40000000-0000-0000-0000-000000000001",
      role: "SUPER_ADMIN",
      tenantId: "00000000-0000-0000-0000-000000000001",
      branchId: "30000000-0000-0000-0000-000000000001",
    },
    {
      tenantId: "00000000-0000-0000-0000-000000000001",
      branchId: "30000000-0000-0000-0000-000000000001",
      dateFrom: "2026-06-11T00:00:00.000Z",
      dateTo: "2026-06-13T00:00:00.000Z",
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "report_pos_sales");
  assert.equal(calls[0].params.length, 8);
  assert.deepEqual(calls[0].params, [
    "40000000-0000-0000-0000-000000000001",
    "SUPER_ADMIN",
    "00000000-0000-0000-0000-000000000001",
    "30000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000001",
    "30000000-0000-0000-0000-000000000001",
    "2026-06-11T00:00:00.000Z",
    "2026-06-13T00:00:00.000Z",
  ]);
});

test("V061 report_pos_sales: elimina overload legacy y conserva firma del adapter", () => {
  const sql = readMigration("V061__drop_legacy_report_pos_sales_overload.sql");

  assert.match(
    sql,
    /DROP FUNCTION IF EXISTS public\.report_pos_sales\(\s*UUID,\s*TEXT,\s*UUID,\s*UUID,\s*UUID,\s*UUID,\s*TIMESTAMPTZ,\s*TIMESTAMPTZ,\s*TEXT,\s*TEXT\s*\);/i
  );
  assert.match(
    sql,
    /public\.report_pos_sales\(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz\)/
  );
  assert.match(
    sql,
    /public\.report_pos_sales\(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text\)/
  );
  assert.match(sql, /legacy report_pos_sales extended overload still exists/);
  assert.match(sql, /report_pos_sales overload count expected 1/);
});

test("SalesReportAdapter.getSalesList: compara source_id text con sale UUID sin error de tipos", async () => {
  let sql = "";
  const adapter = new SalesReportAdapter({
    executeFunction: async () => ({ rows: [{ saleId: "sale-1" }] }),
  } as never, {
    query: async (query: string) => {
      sql = query;
      return { rows: [] };
    },
  } as never);

  await adapter.getSalesList(
    {
      userId: "40000000-0000-0000-0000-000000000001",
      role: "SUPER_ADMIN",
      tenantId: "00000000-0000-0000-0000-000000000001",
      branchId: null,
    },
    { tenantId: undefined, branchId: undefined },
  );

  assert.match(sql, /event\.source_id\s*=\s*s\.id::TEXT/i);
  assert.match(sql, /\$4::UUID\s+IS\s+NULL/i);
});

test("SalesReportAdapter.getElectronicInvoice: scopes lookup by tenant and branch", async () => {
  const adapter = new SalesReportAdapter({
    executeFunction: async () => null,
  } as never, {
    query: async (_sql: string, params: unknown[]) => {
      assert.deepEqual(params, ["sale-1", "tenant-a", "USER", "branch-a"]);
      return {
        rows: [
          {
            saleId: "sale-1",
            electronicDocumentId: "document-1",
            status: "ACCEPTED",
            documentNumber: "SETP-1",
            cufe: "cufe-1",
            acceptedAt: "2026-09-11T10:00:00.000Z",
            providerStatusCode: "100",
            providerStatusMessage: "Aceptado",
            trackingId: "track-1",
            representationAvailable: true,
            fiscalIssuerSnapshot: {
              name: "Facturador DIAN",
              identificationType: "NIT",
              identificationNumber: "1045697508",
              verificationDigit: "5",
              address: "CL 18B 17F 24",
              country: "CO",
              department: "Atlántico",
              municipality: "Barranquilla",
              phone: "3022243805",
              email: "fiscal@example.test",
            },
            customerFiscalSnapshot: { name: "Cliente snapshot", fiscalResponsibilityCodes: ["O-13"] },
            taxLines: [{ type: "IVA", code: "01", rate: 19, taxableBase: "100", amount: "19" }],
            qrPayload: "https://qr.example/accepted",
          },
        ],
      };
    },
  } as never);

  const result = await adapter.getElectronicInvoice(
    {
      userId: "user-1",
      role: "USER",
      tenantId: "tenant-a",
      branchId: "branch-a",
    },
    "sale-1"
  );

  assert.equal(result?.representationAvailable, true);
  assert.equal(result?.fiscalIssuerSnapshot?.identificationNumber, "1045697508");
  assert.equal(result?.fiscalIssuerSnapshot?.verificationDigit, "5");
  assert.equal(result?.cufe, "cufe-1");
  assert.equal(result?.customerFiscalSnapshot?.name, "Cliente snapshot");
  assert.equal(result?.taxLines?.[0]?.amount, 19);
  assert.equal(result?.qrPayload, "https://qr.example/accepted");
});

test("SalesReportAdapter.getElectronicInvoice: rejects ambiguous documents", async () => {
  const adapter = new SalesReportAdapter({ executeFunction: async () => null } as never, {
    query: async () => ({ rows: [{}, {}] }),
  } as never);

  await assert.rejects(
    adapter.getElectronicInvoice(
      { userId: "user-1", role: "USER", tenantId: "tenant-a", branchId: "branch-a" },
      "sale-1"
    ),
    /ambiguous electronic documents/
  );
});

test("SalesReportAdapter.getPrintableCompany: usa razon_social y branding, con fallback controlado", async () => {
  const adapter = new SalesReportAdapter({ executeFunction: async () => null } as never, {
    query: async () => ({ rows: [{
      tenantName: "Tenant Principal",
      config: { logo: "data:image/png;base64,AAA" },
      legalName: "Razón Social S.A.S.",
      nit: "900123456",
      dv: "7",
      taxResponsibilities: "O-13",
      regime: "No responsable",
      vatResponsibility: "NOT_RESPONSIBLE",
      address: "Calle 1",
      city: "Bogotá",
      department: "Cundinamarca",
      country: "Colombia",
      phone: "3000000000",
      email: "facturacion@example.test",
      website: null,
      branchName: "Principal",
      branchAddress: "Calle 1",
      branchCity: "Bogotá",
      branchDepartment: "Cundinamarca",
      branchCountry: "Colombia",
      branchPhone: null,
      branchEmail: null,
    }] }),
  } as never);
  const result = await adapter.getPrintableCompany({
    userId: "user-1", role: "USER", tenantId: "tenant-a", branchId: "branch-a",
  });
  assert.equal(result.legalName, "Razón Social S.A.S.");
  assert.equal(result.logo, "data:image/png;base64,AAA");
  assert.equal(result.branchName, "Principal");
});
