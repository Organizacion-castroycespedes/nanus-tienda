import assert from "node:assert/strict";
import test from "node:test";
import { buildInventoryValuationLayout } from "./inventory-bi-valuation-report.template";

test("valuation PDF layout uses readable labels and presentation formats", () => {
  const layout = buildInventoryValuationLayout({
    generatedAt: "2026-09-22T15:00:00.000Z", generatedBy: "qa", filters: {
      Empresa: "Empresa QA", Sucursal: "Principal", Productos: "Producto Á, Producto B",
      Categoría: "Categoría QA", "Estado de stock": "Con stock",
    },
    branding: { name: "Empresa QA", legalName: null, nit: null, address: null, phone: null, logo: null, primaryColor: null },
    summary: { totalCost: "3052216835.0000", totalUnits: "46081.9700", totalRows: 1 },
    rows: [{ tenantId: "tenant", branchId: "branch", productId: "product", productName: "Producto Á",
      sku: "SKU-1", categoryId: null, categoryName: null, branchName: "Principal", realStock: "-1.2500",
      realUnitCost: "10.0000", inventoryCost: "-12.5000", participationPercent: "-0.4100", stockStatus: "negative" }],
  });
  const serialized = JSON.stringify(layout);
  assert.match(serialized, /Empresa QA/);
  assert.match(serialized, /COP 3\.052\.216\.835,00/);
  assert.match(serialized, /46\.081,97/);
  assert.match(serialized, /Stock negativo/);
  const detailTable = (layout.content as Array<{ table?: { widths?: number[]; body?: unknown[][] } }>).find((item) => item.table?.body?.[0]?.some((cell: any) => cell?.text === "Estado"));
  assert.deepEqual(detailTable?.table?.widths, [130, 48, 72, 72, 58, 82, 86, 72, 100]);
  assert.equal((detailTable?.table?.body?.[1]?.[8] as any)?.style, "stateCell");
  assert.equal((detailTable?.table?.body?.[1]?.[8] as any)?.text, "Stock negativo");
  assert.doesNotMatch(serialized, /tenantId|branchId|productIds|categoryId|stockStatus/);
});
