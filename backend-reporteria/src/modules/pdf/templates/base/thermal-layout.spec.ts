import assert from "node:assert/strict";
import test from "node:test";
import { buildPosSaleTicketTemplate } from "../tickets/pos-sale-ticket.template";
import type { PosSaleTicketDataset } from "../../../reports/types/sales-report.types";
import {
  addThermalSoftBreaks,
  buildThermalDocument,
  THERMAL_80MM_LAYOUT,
} from "./thermal-layout";

const longSaleId = "70000000-0000-0000-0000-000000000001";

const ticketDataset: PosSaleTicketDataset = {
  header: {
    saleId: longSaleId,
    date: "2026-08-20T12:00:00.000Z",
    tenantName: "Tienda Castro & Cespedes",
    branch: "Sucursal principal",
    branchId: "30000000-0000-0000-0000-000000000001",
    terminal: "Terminal caja uno",
    terminalId: "50000000-0000-0000-0000-000000000001",
    cashier: "Cajero QA",
    cashierId: "40000000-0000-0000-0000-000000000001",
    customer: "Consumidor final",
    customerId: null,
    status: "CONFIRMED",
    paymentStatus: "PAID",
  },
  items: [
    {
      productName: "Producto-con-identificador-muy-largo-sin-espacios-1234567890",
      quantity: 1,
      unitPrice: 40000,
      subtotal: 40000,
    },
  ],
  payments: [],
  paymentBreakdown: [{ method: "Efectivo", amount: 40000 }],
  totals: {
    subtotal: 40000,
    taxes: 0,
    total: 40000,
    paid: 40000,
    change: 0,
    balance: 0,
  },
  cashContext: null,
};

test("THERMAL_80MM reserves safe content inside nominal paper", () => {
  const document = buildThermalDocument({ title: "Ticket" });

  assert.deepEqual(document.pageSize, {
    width: THERMAL_80MM_LAYOUT.paperWidthPt,
    height: "auto",
  });
  assert.deepEqual(document.pageMargins, [
    THERMAL_80MM_LAYOUT.safeHorizontalMarginPt,
    THERMAL_80MM_LAYOUT.safeVerticalMarginPt,
    THERMAL_80MM_LAYOUT.safeHorizontalMarginPt,
    THERMAL_80MM_LAYOUT.safeVerticalMarginPt,
  ]);
  assert.ok(
    THERMAL_80MM_LAYOUT.safeContentWidthPt <
      THERMAL_80MM_LAYOUT.printableWidthPt
  );
});

test("THERMAL_80MM adds safe breaks to long unbroken identifiers", () => {
  const result = addThermalSoftBreaks(longSaleId);

  assert.match(result, /\u200B/);
  assert.equal(result.replaceAll("\u200B", ""), longSaleId);
});

test("POS ticket reserves item and total amount columns", () => {
  const document = buildPosSaleTicketTemplate(ticketDataset) as unknown as {
    content: Array<{
      stack?: Array<{
        table?: { widths?: unknown[]; body?: unknown[] };
      }>;
      table?: { widths?: unknown[]; body?: unknown[] };
    }>;
  };
  const itemTable = document.content
    .flatMap((entry) => entry.stack ?? [])
    .find((entry) => entry.table?.body?.length === 2)?.table;
  const totalsTable = document.content.find(
    (entry) => entry.table?.body?.length === 6
  )?.table;

  assert.deepEqual(itemTable?.widths, ["*", THERMAL_80MM_LAYOUT.itemAmountColumnWidthPt]);
  assert.deepEqual(totalsTable?.widths, ["*", THERMAL_80MM_LAYOUT.totalsAmountColumnWidthPt]);
});

test("POS ticket preserves full totals as presentation input", () => {
  const document = buildPosSaleTicketTemplate(ticketDataset) as unknown as {
    content: Array<{
      table?: { body?: Array<Array<{ text?: string }>> };
    }>;
  };
  const totalsTable = document.content.find(
    (entry) => entry.table?.body?.length === 6
  )?.table;
  const totalRow = totalsTable?.body?.find((row) => row[0]?.text === "Total");

  assert.equal(totalRow?.[1]?.text, "$ 40.000");
});
