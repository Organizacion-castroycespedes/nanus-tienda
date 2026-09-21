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

test("SalesReportAdapter.getSalesList: usa la fuente customers y el filtro normalizado", async () => {
  let sql = "";
  const adapter = new SalesReportAdapter({
    executeFunction: async () => null,
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
      branchId: "30000000-0000-0000-0000-000000000001",
    },
    {
      tenantId: "00000000-0000-0000-0000-000000000001",
      branchId: "30000000-0000-0000-0000-000000000001",
      dateFrom: "2026-06-11T00:00:00.000Z",
      dateTo: "2026-06-13T00:00:00.000Z",
      customerDocument: "  900-123  ",
    }
  );

  assert.match(sql, /public\.customers AS customer/);
  assert.match(sql, /customer\.document_number_normalized/);
  assert.match(sql, /customer\.identification_number/);
  assert.match(sql, /customer\.document_number/);
  assert.match(sql, /\$9::text/);
  assert.doesNotMatch(sql, /report_pos_sales/);
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

test("SalesReportAdapter.getSalesList: preserva scope de sesión y unión de cliente", async () => {
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

  assert.match(sql, /pos_user_sessions/);
  assert.match(sql, /customer\.id\s*=\s*sale\.customer_id/i);
  assert.match(sql, /\$9::text/);
});

test("SalesReportAdapter POS export uses the same actor scope with real count and batches", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const adapter = new SalesReportAdapter({ executeFunction: async () => null } as never, {} as never);
  const client = {
    query: async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return sql.includes("COUNT(*)")
        ? { rows: [{ count: "1001" }] }
        : { rows: [{ saleId: "sale-1", total: "10", paid: "10", balance: "0", billingStatus: "ACCEPTED" }] };
    },
  } as never;
  const actor = {
    userId: "40000000-0000-0000-0000-000000000001",
    role: "USER",
    tenantId: "00000000-0000-0000-0000-000000000001",
    branchId: "30000000-0000-0000-0000-000000000001",
  };

  const filters = { dateFrom: "2026-09-20T00:00:00.000Z", customerDocument: "900123" };
  assert.equal(await adapter.getPosExportCount(actor, filters, client), 1001);
  const rows = await adapter.getPosExportBatch(actor, filters, client, 1000, 1000);

  assert.equal(rows[0].billingStatus, "ACCEPTED");
  assert.match(queries[0].sql, /report_resolve_pos_scope/);
  assert.match(queries[0].sql, /report_resolve_pos_scope\(\s*\$2::text,\s*\$3::uuid,\s*\$4::uuid,\s*\$5::uuid,\s*\$6::uuid\s*\)/i);
  assert.match(queries[1].sql, /report_resolve_pos_scope\(\s*\$2::text,\s*\$3::uuid,\s*\$4::uuid,\s*\$5::uuid,\s*\$6::uuid\s*\)/i);
  assert.deepEqual(queries[0].params.slice(0, 6), [
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.branchId,
    null,
    null,
  ]);
  assert.equal(queries[0].params[8], "900123");
  assert.equal(queries[1].params[8], "900123");
  assert.match(queries[1].sql, /LIMIT \$10::integer OFFSET \$11::integer/);
  assert.deepEqual(queries[1].params.slice(-2), [1000, 1000]);
});

test("SalesReportAdapter.getElectronicInvoice: scopes lookup by tenant and branch", async () => {
  let sql = "";
  const adapter = new SalesReportAdapter({
    executeFunction: async () => null,
  } as never, {
    query: async (query: string, params: unknown[]) => {
      sql = query;
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
  assert.match(sql, /document\.source_id\s*=\s*s\.id::TEXT/i);
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
