import type { TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { PurchasesReportListDataset } from "../../../reports/types/purchases-report.types";

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

export const buildPurchasesReportLayout = (
  dataset: PurchasesReportListDataset
): TDocumentDefinitions => ({
  pageSize: "A4",
  pageMargins: [32, 32, 32, 32],
  content: [
    {
      margin: [0, 0, 0, 16],
      stack: [
        { text: "Reporte de compras", style: "title" },
        { text: `Tenant: ${dataset.filters.tenantId}`, style: "subtitle" },
        {
          text: `Sucursal: ${dataset.filters.branchId ?? "Todas"} | Desde: ${formatDate(
            dataset.filters.dateFrom
          )} | Hasta: ${formatDate(dataset.filters.dateTo)} | Estado: ${
            dataset.filters.status ?? "Todos"
          }`,
          style: "meta",
        },
      ],
    },
    {
      margin: [0, 0, 0, 16],
      columns: [
        { width: "*", text: `Compras: ${dataset.summary.count}`, style: "summary" },
        { width: "*", text: `Total: ${formatCurrency(dataset.summary.total)}`, style: "summary" },
        {
          width: "*",
          text: `No recibido: ${formatCurrency(dataset.summary.totalNoRecibido ?? 0)}`,
          style: "summary",
        },
        { width: "*", text: `Pagado: ${formatCurrency(dataset.summary.paid)}`, style: "summary" },
        {
          width: "*",
          text: `Saldo: ${formatCurrency(dataset.summary.balance)}`,
          style: "summary",
          alignment: "right",
        },
      ],
    },
    {
      table: {
        headerRows: 1,
        widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto"],
        body: [
          [
            { text: "Compra", style: "tableHeader" },
            { text: "Proveedor", style: "tableHeader" },
            { text: "Estado", style: "tableHeader" },
            { text: "Total", style: "tableHeader", alignment: "right" },
            { text: "No recibido", style: "tableHeader", alignment: "right" },
            { text: "Pagado", style: "tableHeader", alignment: "right" },
            { text: "Saldo", style: "tableHeader", alignment: "right" },
          ] as TableCell[],
          ...dataset.rows.map(
            (row) =>
              [
                { stack: [row.purchaseId, { text: formatDate(row.date), color: "#475569" }] },
                row.supplierName,
                `${row.status} / ${row.paymentStatus}`,
                { text: formatCurrency(row.total), alignment: "right" },
                {
                  text: formatCurrency(row.diferenciaNoRecibida ?? 0),
                  alignment: "right",
                },
                { text: formatCurrency(row.paid), alignment: "right" },
                { text: formatCurrency(row.balance), alignment: "right" },
              ] as TableCell[]
          ),
        ],
      },
      layout: "lightHorizontalLines",
    },
  ],
  styles: {
    title: { fontSize: 17, bold: true },
    subtitle: { fontSize: 10, margin: [0, 4, 0, 0] },
    meta: { fontSize: 9, color: "#64748b", margin: [0, 4, 0, 0] },
    summary: { fontSize: 10, bold: true },
    tableHeader: { bold: true, fillColor: "#e2e8f0" },
  },
  defaultStyle: {
    font: "Roboto",
    fontSize: 9,
  },
});
