import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { QuotationPdfService } from "./quotation-pdf.service";

const ids = {
  tenant: "50000000-0000-4000-8000-000000000001",
  branch: "50000000-0000-4000-8000-000000000002",
  otherBranch: "50000000-0000-4000-8000-000000000003",
  quotation: "50000000-0000-4000-8000-000000000004",
  user: "50000000-0000-4000-8000-000000000005",
};

const user = { id: ids.user, tenantId: ids.tenant, branchId: ids.branch, roles: ["USER"] };

const headerRow = (branchId = ids.branch) => ({
  id: ids.quotation, tenant_id: ids.tenant, branch_id: branchId, branch_name: "Centro", code: "COT-000007",
  effective_status: "EXPIRED", issue_date: new Date("2026-11-01T00:00:00.000Z"), validity_days: 15,
  valid_until: "2026-11-16", subtotal: "1000.00", discount_total: "0", tax_total: "190.00", total: "1190.00",
  commercial_terms: null, payment_delivery_terms: null, warranty_terms: null, notes: "Nota",
  customer_name: "Cliente", customer_document: "123", customer_email: null, customer_phone: null, customer_address: null,
  tenant_name: "Tienda", tenant_config: { logoUrl: "data:image/png;base64,AAA=", colors: { primary: "#123456", secondary: "#abcdef" } },
  legal_name: "Tienda SAS", nit: "900", dv: "1", company_address: null, company_city: null, company_phone: null,
  company_email: null, company_website: null, representative_name: "Rep", representative_document_type: "CC",
  representative_document_number: "1",
});

const itemRows = [
  {
    line_number: 1, product_code: "A", product_name: "Producto A", unit_code: "UND", quantity: "2.000",
    final_unit_price: "500.00", discount_percent: "0", applied_promotion_name: null, tax_rate: "19", tax_base: "1000",
    tax_amount: "190", line_total: "1190",
    pricing_snapshot: JSON.stringify({ taxes: [{ taxName: "IVA", taxRate: 19, taxBase: 1000, taxAmount: 190 }] }),
  },
];

const build = (header: ReturnType<typeof headerRow> | null, branchIds = [ids.branch]) => {
  const queries: Array<{ text: string; params: unknown[] }> = [];
  const service = new QuotationPdfService(
    {
      query: async (text: string, params: unknown[]) => {
        queries.push({ text, params });
        if (text.includes("FROM public.quotations q")) return { rows: header ? [header] : [] };
        return { rows: itemRows };
      },
    } as never,
    { resolve: async () => ({ tenantId: ids.tenant, branchIds }) } as never,
    { generatePdf: async () => Buffer.from("%PDF-1.4") } as never
  );
  return { service, queries };
};

test("arma el dataset con estado efectivo, branding del tenant e impuestos agrupados", async () => {
  const { service, queries } = build(headerRow());
  const dataset = await service.getDataset(ids.quotation, user);
  assert.equal(dataset.quotation.status, "EXPIRED");
  assert.equal(dataset.quotation.issueDate, "2026-11-01");
  assert.equal(dataset.quotation.total, 1190);
  assert.equal(dataset.items[0].quantity, 2);
  assert.deepEqual(dataset.taxes, [{ taxName: "IVA", taxRate: 19, taxBase: 1000, taxAmount: 190 }]);
  assert.equal(dataset.company.logo, "data:image/png;base64,AAA=");
  assert.equal(dataset.company.primaryColor, "#123456");
  assert.equal(dataset.company.accentColor, "#abcdef");
  assert.deepEqual(queries[0].params, [ids.quotation, ids.tenant]);
  assert.match(queries[0].text, /fnc_quotation_effective_status/);
});

test("rechaza cotizacion de una sucursal no autorizada", async () => {
  const { service } = build(headerRow(ids.otherBranch));
  await assert.rejects(service.getDataset(ids.quotation, user), ForbiddenException);
});

test("responde no encontrado para otra empresa o id inexistente", async () => {
  const { service } = build(null);
  await assert.rejects(service.getDataset(ids.quotation, user), NotFoundException);
  await assert.rejects(service.getDataset("no-es-uuid", user), /invalid/);
});

test("getPdf devuelve el buffer y el codigo", async () => {
  const { service } = build(headerRow());
  const result = await service.getPdf(ids.quotation, user);
  assert.equal(result.code, "COT-000007");
  assert.equal(result.buffer.toString(), "%PDF-1.4");
});
