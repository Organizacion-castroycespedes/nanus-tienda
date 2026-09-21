import test from "node:test";
import assert from "node:assert/strict";
import { ReportLayout } from "./ReportLayout";

test("ReportLayout exposes reusable header, toolbar, summary and data slots", () => {
  const element = ReportLayout({
    title: "Reporte POS",
    description: "Ventas del día",
    toolbar: "filters-actions",
    summary: "summary",
    children: "data-pagination",
  }) as { props: { children: unknown } };

  assert.equal(Array.isArray(element.props.children), true);
  assert.equal((element.props.children as unknown[]).length, 4);
});
