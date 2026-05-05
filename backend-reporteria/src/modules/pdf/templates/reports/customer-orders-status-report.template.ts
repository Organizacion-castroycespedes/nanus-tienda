import type { TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { CustomerOrdersStatusDataset } from "../../../reports/types/customers-report.types";

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

export const buildCustomerOrdersStatusReportLayout = (
  dataset: CustomerOrdersStatusDataset
): TDocumentDefinitions => ({
  pageSize: "A4",
  pageMargins: [32, 32, 32, 32],
  content: [
    {
      margin: [0, 0, 0, 16],
      stack: [
        { text: "Reporte de clientes con pedidos", style: "title" },
        { text: `Tenant: ${dataset.filters.tenantId}`, style: "subtitle" },
        {
          text: `Sucursal: ${dataset.filters.branchId ?? "Todas"} | Desde: ${formatDate(
            dataset.filters.dateFrom
          )} | Hasta: ${formatDate(dataset.filters.dateTo)}`,
          style: "meta",
        },
      ],
    },
    {
      margin: [0, 0, 0, 16],
      columns: [
        { width: "*", text: `Clientes: ${dataset.summary.count}`, style: "summary" },
        {
          width: "*",
          text: `Pedidos: ${dataset.summary.totalOrders}`,
          style: "summary",
        },
        {
          width: "*",
          text: `Monto: ${formatCurrency(dataset.summary.totalAmount)}`,
          style: "summary",
        },
        {
          width: "*",
          text: `Pendiente: ${formatCurrency(dataset.summary.totalPending)}`,
          style: "summary",
          alignment: "right",
        },
      ],
    },
    {
      table: {
        headerRows: 1,
        widths: ["*", "auto", "auto", "auto", "auto", "auto", "auto"],
        body: [
          [
            { text: "Cliente", style: "tableHeader" },
            { text: "Total", style: "tableHeader", alignment: "right" },
            { text: "Pend.", style: "tableHeader", alignment: "right" },
            { text: "Parcial", style: "tableHeader", alignment: "right" },
            { text: "Comp.", style: "tableHeader", alignment: "right" },
            { text: "Monto", style: "tableHeader", alignment: "right" },
            { text: "Saldo", style: "tableHeader", alignment: "right" },
          ] as TableCell[],
          ...dataset.rows.map(
            (row) =>
              [
                row.customerName,
                { text: String(row.totalOrders), alignment: "right" },
                { text: String(row.pendingOrders), alignment: "right" },
                { text: String(row.partialOrders), alignment: "right" },
                { text: String(row.completedOrders), alignment: "right" },
                { text: formatCurrency(row.totalAmount), alignment: "right" },
                { text: formatCurrency(row.totalPending), alignment: "right" },
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
