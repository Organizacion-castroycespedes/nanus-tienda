import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { InventoryValuationExportDataset, InventoryValuationExportRow } from "./inventory-bi-valuation-reports.service";
import { formatGeneratedAt, formatMoney, formatPercent, formatUnits, stockStatusLabel } from "./inventory-bi-valuation-formatters";

const accent = (code: number) => String.fromCharCode(code);
const categoryLabel = `Categor${accent(237)}a`;
const participationLabel = `Participaci${accent(243)}n`;
const generatedLabel = `Fecha de generaci${accent(243)}n`;
const text = (value: string | null | undefined) => value == null || value === "" ? "-" : value;

const logoContent = (logo: string | null): Content => {
  if (logo && /^data:image\/(png|jpeg);base64,/i.test(logo)) return { image: logo, width: 52, height: 38 };
  if (logo && /^data:image\/svg\+xml;base64,/i.test(logo)) {
    const svg = Buffer.from(logo.split(",", 2)[1], "base64").toString("utf8");
    if (svg.includes("<svg")) return { svg, width: 52, height: 38 };
  }
  return { text: "" };
};

const rowCells = (row: InventoryValuationExportRow): TableCell[] => [
  { text: text(row.productName), style: "cellText" }, { text: text(row.sku), style: "cellText" },
  { text: text(row.categoryName ?? `Sin ${categoryLabel.toLowerCase()}`), style: "cellText" }, { text: text(row.branchName), style: "cellText" },
  { text: formatUnits(row.realStock), style: "numberCell" }, { text: formatMoney(row.realUnitCost), style: "moneyCell" },
  { text: formatMoney(row.inventoryCost), style: "moneyCell" }, { text: formatPercent(row.participationPercent), style: "moneyCell" },
  { text: stockStatusLabel(row.stockStatus), style: "stateCell" },
];

export const buildInventoryValuationLayout = (dataset: InventoryValuationExportDataset): TDocumentDefinitions => {
  const headings = ["Producto", "SKU", categoryLabel, "Sucursal", "Stock actual", "Costo unitario", "Costo total", participationLabel, "Estado"];
  const filterRows = Object.entries(dataset.filters).map(([key, value]) => [
    { text: key, style: "filterLabel" }, { text: value, style: "filterValue" },
  ] as TableCell[]);
  return {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [24, 28, 24, 32],
    content: [
      { columns: [logoContent(dataset.branding.logo), { width: "*", stack: [
        { text: dataset.branding.name, style: "company" }, { text: dataset.branding.legalName ?? "", style: "meta" },
        { text: [dataset.branding.nit ? `NIT ${dataset.branding.nit}` : "", dataset.branding.address ?? "", dataset.branding.phone ?? ""].filter(Boolean).join("  |  "), style: "meta" },
      ] }], margin: [0, 0, 0, 10] },
      { text: `Valorizaci${accent(243)}n de Inventario`, style: "title", color: dataset.branding.primaryColor ?? "#2563eb" },
      { text: `${generatedLabel}: ${formatGeneratedAt(dataset.generatedAt)}  |  Filas: ${dataset.rows.length}`, style: "meta" },
      { table: { widths: [105, "*"], body: filterRows }, layout: "noBorders", margin: [0, 4, 0, 8] },
      { table: { widths: [180, "*"], body: [
        [{ text: "Costo total valorizado", style: "summaryLabel" }, { text: formatMoney(dataset.summary.totalCost), style: "summaryValue", alignment: "right" }],
        [{ text: "Unidades valorizadas", style: "summaryLabel" }, { text: formatUnits(dataset.summary.totalUnits), style: "summaryValue", alignment: "right" }],
      ] }, layout: "noBorders", margin: [0, 0, 0, 10] },
      { table: { headerRows: 1, dontBreakRows: true, widths: [130, 48, 72, 72, 58, 82, 86, 72, 100], body: [
        headings.map((heading) => ({ text: heading, style: heading === "Estado" ? "stateHeader" : "header" })) as TableCell[],
        ...(dataset.rows.length ? dataset.rows.map(rowCells) : [[
          { text: "No hay registros para los filtros aplicados", colSpan: headings.length, style: "empty" }, ...Array(headings.length - 1).fill(""),
        ] as TableCell[]]),
      ] }, layout: {
        hLineColor: "#cbd5e1", vLineColor: "#e2e8f0", paddingLeft: () => 3,
        paddingRight: () => 3, paddingTop: () => 3, paddingBottom: () => 3,
      } },
    ],
    footer: (page, total) => ({ text: `Manus POS  |  ${page} / ${total}`, alignment: "right", margin: [0, 0, 24, 0], fontSize: 8, color: "#475569" }),
    styles: {
      company: { fontSize: 12, bold: true }, title: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] }, meta: { fontSize: 8, color: "#475569" },
      filterLabel: { fontSize: 8, bold: true }, filterValue: { fontSize: 8 }, header: { bold: true, fillColor: "#e2e8f0", color: "#0f172a", fontSize: 7.3 },
      cellText: { fontSize: 7.1 }, stateCell: { fontSize: 7.1, noWrap: true }, numberCell: { fontSize: 7.1, alignment: "right", noWrap: true }, moneyCell: { fontSize: 7, alignment: "right", noWrap: true },
      stateHeader: { bold: true, fillColor: "#e2e8f0", color: "#0f172a", fontSize: 7.1, noWrap: true },
      summaryLabel: { fontSize: 9, bold: true }, summaryValue: { fontSize: 9, bold: true, noWrap: true }, empty: { fontSize: 8, alignment: "center" },
    },
    defaultStyle: { font: "Roboto", fontSize: 8 },
  };
};
