import test from "node:test";
import assert from "node:assert/strict";
import { ReportSummary } from "./ReportSummary";

test("ReportSummary renders one compact band with four metric segments", () => {
  const element = ReportSummary({
    items: [
      { label: "Ventas", value: 4 },
      { label: "Total", value: "$ 100" },
      { label: "Pagado", value: "$ 80" },
      { label: "Saldo", value: "$ 20" },
    ],
  }) as { props: { children: unknown; className: string } };

  assert.match(element.props.className, /md:grid-cols-4/);
  assert.equal(Array.isArray(element.props.children), true);
  assert.equal((element.props.children as unknown[]).length, 4);
});

test("ReportSummary admite seis segmentos sin celdas vacías en 2, 3 o 6 columnas", () => {
  const element = ReportSummary({
    columns: 6,
    ariaLabel: "Indicadores del resultado",
    items: ["A", "B", "C", "D", "E", "F"].map((label) => ({ label, value: 1 })),
  }) as { props: { children: unknown[]; className: string; "aria-label": string } };

  assert.match(element.props.className, /grid-cols-2 sm:grid-cols-3 xl:grid-cols-6/);
  assert.doesNotMatch(element.props.className, /md:grid-cols-4/);
  assert.equal(element.props["aria-label"], "Indicadores del resultado");
  assert.equal(element.props.children.length, 6);
});

test("ReportSummary muestra tooltip y línea secundaria opcionales", () => {
  const element = ReportSummary({
    items: [{ label: "Discrep.", value: "1 / 2", title: "ayuda", detail: "Conciliación · Todas", detailTitle: "Todas" }],
  }) as { props: { children: Array<{ props: { title?: string; children: unknown[] } }> } };

  const segment = element.props.children[0];
  assert.equal(segment.props.title, "ayuda");
  const detail = segment.props.children[2] as { props: { title?: string; children: unknown } };
  assert.equal(detail.props.title, "Todas");
  assert.equal(detail.props.children, "Conciliación · Todas");
});

test("ReportSummary conserva el valor por defecto sin línea secundaria", () => {
  const element = ReportSummary({ items: [{ label: "Total", value: 0 }] }) as {
    props: { className: string; "aria-label": string; children: Array<{ props: { children: unknown[] } }> };
  };

  assert.match(element.props.className, /grid-cols-2 md:grid-cols-4/);
  assert.equal(element.props["aria-label"], "Resumen del reporte");
  assert.equal(element.props.children[0].props.children[2], null);
});
