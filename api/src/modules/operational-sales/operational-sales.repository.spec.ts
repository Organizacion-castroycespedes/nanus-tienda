import assert from "node:assert/strict";
import test from "node:test";
import { OperationalSalesRepository } from "./operational-sales.repository";

const scope = {
  tenantId: "tenant-a",
  allTenants: false,
  branchIds: ["branch-a"],
  requiresCurrentShift: false,
};

const saleRow = (overrides: Record<string, unknown> = {}) => ({
  sale_id: "sale-a",
  tenant_id: "tenant-a",
  branch_id: "branch-a",
  terminal_id: null,
  user_id: null,
  pos_session_id: null,
  cash_session_id: null,
  sale_status: "REFUNDED",
  sale_type: "POS",
  total: "100.00",
  balance: "0.00",
  payment_status: "PENDING",
  total_paid: "0.00",
  balance_due: "0.00",
  created_at: "2026-10-01T12:00:00.000Z",
  customer_id: "customer-a",
  customer_name: "Cliente",
  customer_document_number: null,
  branch_name: "Sucursal",
  operator_email: null,
  billing_status: "ACCEPTED",
  billing_document_id: "invoice-id",
  billing_document_number: "SETP990000010",
  billing_cufe: "cufe-invoice",
  billing_provider_document_id: "provider-invoice-id",
  billing_provider_status: "ACCEPTED",
  billing_error_code: null,
  billing_error_message: null,
  billing_created_at: "2026-10-01T12:00:00.000Z",
  billing_updated_at: "2026-10-01T12:01:00.000Z",
  billing_document_count: "1",
  electronic_billing_enabled: true,
  ...overrides,
});

const createRepository = (row: ReturnType<typeof saleRow>) => {
  const statements: string[] = [];
  const db = {
    query: async (sql: string) => {
      statements.push(sql);
      return sql.includes("SELECT s.id AS sale_id") ? { rows: [row] } : { rows: [] };
    },
  };
  return { repository: new OperationalSalesRepository(db as never), statements };
};

test("operational sale projection keeps the original invoice separate from other document types", async () => {
  const { repository, statements } = createRepository(saleRow());
  const detail = await repository.findById(scope, "sale-a");

  assert.equal(detail?.electronicBilling?.status, "ACCEPTED");
  assert.equal(detail?.electronicBilling?.documentNumber, "SETP990000010");

  const select = statements[0];
  assert.match(select, /d\.document_type = 'INVOICE'/);
  assert.match(select, /d\.tenant_id = s\.tenant_id AND d\.source_type = 'SALE' AND d\.source_id = s\.id/);
  assert.equal(statements.length, 3, "detail uses one sale query plus its existing items and payments queries");
});

test("operational sale projection does not invent an invoice when no invoice document exists", async () => {
  const { repository } = createRepository(saleRow({
    billing_document_id: null,
    billing_status: null,
    billing_document_number: null,
    billing_document_count: "0",
    sale_status: "CONFIRMED",
  }));
  const detail = await repository.findById(scope, "sale-a");
  assert.equal(detail?.electronicBilling, null);
});
