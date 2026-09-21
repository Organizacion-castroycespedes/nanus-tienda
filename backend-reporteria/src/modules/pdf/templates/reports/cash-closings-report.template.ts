import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { CashClosingListDataset } from "../../../reports/types/cash-report.types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

const buildHeader = (dataset: CashClosingListDataset): Content => ({
  margin: [0, 0, 0, 16],
  columns: [
    (() => {
      const logo = dataset.branding?.logo;
      if (logo && /^data:image\/(png|jpeg);base64,/i.test(logo)) return { image: logo, width: 56, height: 42 };
      if (logo && /^data:image\/svg\+xml;base64,/i.test(logo)) {
        const svg = Buffer.from(logo.split(",", 2)[1], "base64").toString("utf8");
        if (svg.includes("<svg")) return { svg, width: 56, height: 42 };
      }
      return { text: "" };
    })(),
    {
      width: "*",
      stack: [
        { text: dataset.branding?.legalName ?? dataset.branding?.tenantName ?? "", style: "company" },
        { text: dataset.branding?.nit ? `NIT ${dataset.branding.nit}` : "", style: "meta" },
        { text: [dataset.branding?.address, dataset.branding?.phone, dataset.branding?.email].filter(Boolean).join("  |  "), style: "meta" },
        { text: "Reporte de cierres de caja", style: "title" },
        { text: `Tenant: ${dataset.branding?.tenantName ?? dataset.branding?.legalName ?? "No disponible"}  |  Rol: ${dataset.filters.actorRole}`, style: "meta" },
        { text: `Sucursal: ${dataset.branding?.branchName ?? "Todas"}  |  Desde: ${dataset.filters.dateFrom ? formatDateTime(dataset.filters.dateFrom) : "-"}  |  Hasta: ${dataset.filters.dateTo ? formatDateTime(dataset.filters.dateTo) : "-"}`, style: "meta" },
      ],
    },
  ],
});

const buildSummary = (dataset: CashClosingListDataset): Content => ({
  margin: [0, 0, 0, 14],
  table: {
    widths: ["*", "*", "*", "*"],
    body: [
      [
        { text: `Sesiones\n${dataset.summary.count}`, style: "summaryCard" },
        { text: `Entradas\n${formatCurrency(dataset.summary.totalIn)}`, style: "summaryCard" },
        { text: `Salidas\n${formatCurrency(dataset.summary.totalOut)}`, style: "summaryCard" },
        { text: `Diferencia\n${formatCurrency(dataset.summary.difference)}`, style: "summaryCard" },
      ] as TableCell[],
    ],
  },
  layout: "noBorders",
});

const buildTable = (dataset: CashClosingListDataset): Content => ({
  table: {
    headerRows: 1,
    dontBreakRows: true,
    keepWithHeaderRows: 1,
    widths: [70, 55, 55, 55, 55, 55, 55],
    body: [
      [
        { text: "Caja / Sesion", style: "tableHeader" },
        { text: "Apertura", style: "tableHeader" },
        { text: "Cierre", style: "tableHeader" },
        { text: "Entradas", style: "tableHeader" },
        { text: "Salidas", style: "tableHeader" },
        { text: "Esperado", style: "tableHeader" },
        { text: "Dif.", style: "tableHeader" },
      ] as TableCell[],
      ...dataset.rows.map(
        (row) =>
          [
            {
              stack: [
                { text: row.cashRegister ?? row.cashSessionId, bold: true },
                { text: row.branchName ?? row.branchId, fontSize: 8, color: "#475569" },
                { text: row.status, fontSize: 8, color: "#475569" },
              ],
            },
            { text: formatCurrency(row.openingAmount), alignment: "right" },
            { text: formatCurrency(row.closingAmount), alignment: "right" },
            { text: formatCurrency(row.totalIn), alignment: "right" },
            { text: formatCurrency(row.totalOut), alignment: "right" },
            { text: formatCurrency(row.expectedAmount), alignment: "right" },
            { text: formatCurrency(row.difference), alignment: "right" },
          ] as TableCell[]
      ),
    ],
  },
  layout: "lightHorizontalLines",
});

export const buildCashClosingsReportLayout = (
  dataset: CashClosingListDataset
): TDocumentDefinitions => ({
  pageSize: "A4",
  pageMargins: [28, 30, 28, 30],
  content: [buildHeader(dataset), buildSummary(dataset), buildTable(dataset)],
  styles: {
    company: { fontSize: 12, bold: true },
    title: { fontSize: 18, bold: true },
    meta: { fontSize: 9, color: "#64748b", margin: [0, 3, 0, 0] },
    summaryCard: {
      margin: [0, 0, 8, 0],
      fillColor: "#f8fafc",
      bold: true,
      fontSize: 10,
    },
    tableHeader: {
      bold: true,
      fillColor: "#e2e8f0",
      fontSize: 9,
    },
  },
  defaultStyle: {
    font: "Roboto",
    fontSize: 9,
  },
});
