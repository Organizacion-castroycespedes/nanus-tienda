import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { OperationalSalesReportDataset } from "../../../reports/types/operational-sales-report.types";
import { REPORT_TIME_ZONE, formatReportDateTime } from "../../../reports/report-date-range";

export const OPERATIONAL_SALES_PAGE_MARGINS: [number, number, number, number] = [28, 28, 28, 28];
// A4 landscape is 841.89pt wide. 841.89 - 28 - 28 = 785.89pt.
export const OPERATIONAL_SALES_TABLE_WIDTHS: number[] = [54, 68, 160, 98, 68, 54, 165, 88];
export const OPERATIONAL_SALES_TABLE_CELL_PADDING = 1;

const money = (value: number) => new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 2,
}).format(value);

const date = (value: string) => new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: REPORT_TIME_ZONE,
}).format(new Date(value));

const buildLogo = (logo: string | null): Content => {
  if (logo && /^data:image\/(png|jpeg);base64,/i.test(logo)) {
    return { image: logo, width: 56, height: 42 };
  }

  if (logo && /^data:image\/svg\+xml;base64,/i.test(logo)) {
    const svg = Buffer.from(logo.split(",", 2)[1], "base64").toString("utf8");
    if (svg.includes("<svg")) {
      return { svg, width: 56, height: 42 };
    }
  }

  return { text: "" };
};

const buildHeader = (dataset: OperationalSalesReportDataset): Content => ({
  margin: [0, 0, 0, 12],
  columns: [
    buildLogo(dataset.branding.logo),
    {
      width: "*",
      stack: [
        { text: dataset.branding.legalName ?? dataset.branding.tenantName ?? "", style: "company" },
        { text: dataset.branding.nit ? `NIT ${dataset.branding.nit}` : "", style: "meta" },
        {
          text: [dataset.branding.address, dataset.branding.phone, dataset.branding.email]
            .filter(Boolean)
            .join(" | "),
          style: "meta",
        },
        { text: "Reporte de ventas operativas", style: "title" },
        { text: `Período: ${formatReportDateTime(dataset.query.dateFrom)} → ${formatReportDateTime(dataset.query.dateTo)} | Zona: ${REPORT_TIME_ZONE} | Generado: ${formatReportDateTime(new Date())}`, style: "meta" },
        { text: `Sucursal: ${dataset.branding.branchName ?? "Todas"}`, style: "meta" },
      ],
    },
  ],
});

const buildRows = (dataset: OperationalSalesReportDataset): Content => ({
  table: {
    headerRows: 1,
    widths: OPERATIONAL_SALES_TABLE_WIDTHS,
    dontBreakRows: true,
    keepWithHeaderRows: 1,
    body: [
      ["Venta", "Fecha", "Cliente", "Sucursal", "Estado", "Pago", "Facturación electrónica", "Total"]
        .map((text) => ({ text, style: "tableHeader" })) as TableCell[],
      ...dataset.rows.map((row) => [
        row.id.slice(0, 12),
        date(row.createdAt),
        row.customerName ?? "Sin cliente",
        row.branchName ?? "Sin sucursal",
        row.status,
        row.paymentStatus,
        row.electronicBillingStatus + (row.electronicDocumentNumber ? ` ${row.electronicDocumentNumber}` : ""),
        { text: money(row.total), alignment: "right" },
      ] as TableCell[]),
    ],
  },
  layout: {
    hLineWidth: (lineIndex: number, node: { table: { body: unknown[]; headerRows?: number } }) => {
      if (lineIndex === 0 || lineIndex === node.table.body.length) return 0;
      return lineIndex === node.table.headerRows ? 2 : 1;
    },
    vLineWidth: () => 0,
    hLineColor: (lineIndex: number) => lineIndex === 1 ? "black" : "#aaa",
    paddingLeft: () => OPERATIONAL_SALES_TABLE_CELL_PADDING,
    paddingRight: () => OPERATIONAL_SALES_TABLE_CELL_PADDING,
    paddingTop: () => 3,
    paddingBottom: () => 3,
  },
});

export const buildOperationalSalesReportLayout = (
  dataset: OperationalSalesReportDataset,
): TDocumentDefinitions => ({
  pageSize: "A4",
  pageOrientation: "landscape",
  pageMargins: OPERATIONAL_SALES_PAGE_MARGINS,
  content: [
    buildHeader(dataset),
    {
      margin: [0, 0, 0, 12],
      text: `Registros: ${dataset.rows.length} | Total: ${money(dataset.rows.reduce((sum, row) => sum + row.total, 0))}`,
      style: "summary",
    },
    buildRows(dataset),
  ],
  styles: {
    company: { fontSize: 12, bold: true },
    title: { fontSize: 16, bold: true, margin: [0, 3, 0, 0] },
    meta: { fontSize: 9, color: "#64748b", margin: [0, 2, 0, 0] },
    summary: { fontSize: 10, bold: true },
    tableHeader: { bold: true, fillColor: "#e2e8f0" },
  },
  defaultStyle: { font: "Roboto", fontSize: 8 },
});
