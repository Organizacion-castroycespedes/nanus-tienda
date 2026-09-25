import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { PosSalesListDataset } from "../../../reports/types/sales-report.types";
import { formatTicketStatus } from "../base/status-label";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "N/A";

const formatSaleIdentifier = (saleId: string) => saleId.length > 12
  ? `${saleId.slice(0, 8)}…`
  : saleId;

const buildHeader = (dataset: PosSalesListDataset): Content => ({
  margin: [0, 0, 0, 16],
  columns: [
    (() => {
      const logo = dataset.branding?.logo;
      if (logo && /^data:image\/(png|jpeg);base64,/i.test(logo)) {
        return { image: logo, width: 56, height: 42 };
      }
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
        {
          text: [dataset.branding?.address, dataset.branding?.phone, dataset.branding?.email]
            .filter(Boolean).join("  |  "),
          style: "meta",
        },
        { text: "Reporte de ventas POS", style: "title" },
        { text: `Tenant: ${dataset.branding?.tenantName ?? dataset.branding?.legalName ?? "No disponible"}`, style: "subtitle" },
        { text: `Sucursal: ${dataset.branding?.branchName ?? "Todas"} | Desde: ${formatDate(dataset.filters.dateFrom)} | Hasta: ${formatDate(dataset.filters.dateTo)}${dataset.filters.customerDocument ? ` | Identificación: ${dataset.filters.customerDocument}` : ""}`, style: "meta" },
      ],
    },
  ],
});

const buildSummary = (dataset: PosSalesListDataset): Content => ({
  margin: [0, 0, 0, 16],
  columns: [
    {
      width: "*",
      text: `Ventas: ${dataset.summary.count}`,
      style: "summary",
    },
    {
      width: "*",
      text: `Total: ${formatCurrency(dataset.summary.total)}`,
      style: "summary",
    },
    {
      width: "*",
      text: `Pagado: ${formatCurrency(dataset.summary.paid)}`,
      style: "summary",
    },
    {
      width: "*",
      text: `Saldo: ${formatCurrency(dataset.summary.balance)}`,
      style: "summary",
      alignment: "right",
    },
  ],
});

const buildRowsTable = (dataset: PosSalesListDataset): Content => ({
  table: {
    headerRows: 1,
    widths: [78, 108, "*", 102, 78, 78, 78],
    dontBreakRows: true,
    keepWithHeaderRows: 1,
    body: [
      [
        { text: "Venta", style: "tableHeader" },
        { text: "Fecha/Hora", style: "tableHeader" },
        { text: "Cliente", style: "tableHeader" },
        { text: "Estado", style: "tableHeader" },
        { text: "Total", style: "tableHeader", alignment: "right" },
        { text: "Pagado", style: "tableHeader", alignment: "right" },
        { text: "Saldo", style: "tableHeader", alignment: "right" },
      ] as TableCell[],
      ...dataset.rows.map(
        (row) =>
          [
            formatSaleIdentifier(row.saleId),
            formatDate(row.date),
            row.customerName,
            `${formatTicketStatus(row.status)} / ${formatTicketStatus(row.paymentStatus)}`,
            { text: formatCurrency(row.total), alignment: "right" },
            { text: formatCurrency(row.paid), alignment: "right" },
            { text: formatCurrency(row.balance), alignment: "right" },
          ] as TableCell[]
      ),
    ],
  },
  layout: "lightHorizontalLines",
});

export const buildPosSalesReportLayout = (
  dataset: PosSalesListDataset
): TDocumentDefinitions => ({
  pageSize: "A4",
  pageOrientation: "landscape",
  pageMargins: [32, 32, 32, 32],
  content: [buildHeader(dataset), buildSummary(dataset), buildRowsTable(dataset)],
  styles: {
    company: { fontSize: 12, bold: true },
    title: {
      fontSize: 17,
      bold: true,
    },
    subtitle: {
      fontSize: 10,
      margin: [0, 4, 0, 0],
    },
    meta: {
      fontSize: 9,
      color: "#64748b",
      margin: [0, 4, 0, 0],
    },
    summary: {
      fontSize: 10,
      bold: true,
    },
    tableHeader: {
      bold: true,
      fillColor: "#e2e8f0",
    },
  },
  defaultStyle: {
    font: "Roboto",
    fontSize: 9,
  },
});
