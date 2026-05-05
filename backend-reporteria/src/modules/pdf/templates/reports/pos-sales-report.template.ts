import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { PosSalesListDataset } from "../../../reports/types/sales-report.types";

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

const buildHeader = (dataset: PosSalesListDataset): Content => ({
  margin: [0, 0, 0, 16],
  stack: [
    { text: "Reporte de ventas POS", style: "title" },
    {
      text: `Tenant: ${dataset.filters.tenantId}`,
      style: "subtitle",
    },
    {
      text: `Sucursal: ${dataset.filters.branchId ?? "Todas"} | Desde: ${formatDate(
        dataset.filters.dateFrom
      )} | Hasta: ${formatDate(dataset.filters.dateTo)}`,
      style: "meta",
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
    widths: ["auto", "auto", "*", "auto", "auto", "auto", "auto"],
    body: [
      [
        { text: "Venta", style: "tableHeader" },
        { text: "Fecha", style: "tableHeader" },
        { text: "Cliente", style: "tableHeader" },
        { text: "Estado", style: "tableHeader" },
        { text: "Total", style: "tableHeader", alignment: "right" },
        { text: "Pagado", style: "tableHeader", alignment: "right" },
        { text: "Saldo", style: "tableHeader", alignment: "right" },
      ] as TableCell[],
      ...dataset.rows.map(
        (row) =>
          [
            row.saleId,
            formatDate(row.date),
            row.customerName,
            `${row.status} / ${row.paymentStatus}`,
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
  pageMargins: [32, 32, 32, 32],
  content: [buildHeader(dataset), buildSummary(dataset), buildRowsTable(dataset)],
  styles: {
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
