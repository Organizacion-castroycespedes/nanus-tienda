import assert from "node:assert/strict";
import test from "node:test";
import { buildReporteriaSaleTicketInput } from "./direct-print";
import type { PosSaleTicketPrintDataset } from "./types";

const dataset: PosSaleTicketPrintDataset = {
  tenantId: "tenant-1",
  ticket: {
    header: {
      saleId: "sale-1", date: "2026-08-20T00:00:00.000Z", tenantName: "Manus",
      branch: "Principal", branchId: "branch-1", terminal: "Caja antigua",
      terminalId: "old-terminal", cashier: "Cajero", customer: "Cliente",
      status: "CONFIRMED", paymentStatus: "PAID",
    },
    items: [{ productName: "Producto", quantity: 2, unitPrice: 20000, subtotal: 40000 }],
    paymentBreakdown: [{ method: "Efectivo", amount: 40000 }],
    totals: {
      subtotal: 40000,
      taxes: 7600,
      taxBreakdown: [
        {
          label: "IVA 19%",
          dianCode: "01",
          taxTypeCode: "VAT",
          taxBase: 40000,
          taxAmount: 7600,
        },
      ],
      total: 40000,
      paid: 40000,
      change: 0,
      balance: 0,
    },
  },
};

test("direct report ticket copies canonical values without recalculation", () => {
  const result = buildReporteriaSaleTicketInput(dataset);

  assert.equal(result.tenantId, "tenant-1");
  assert.equal(result.branchId, "branch-1");
  assert.equal(result.total, 40000);
  assert.equal(result.paid, 40000);
  assert.equal(result.items?.[0]?.total, 40000);
  assert.deepEqual(result.taxLines, [{ label: "IVA 19%", amount: 7600 }]);
});
