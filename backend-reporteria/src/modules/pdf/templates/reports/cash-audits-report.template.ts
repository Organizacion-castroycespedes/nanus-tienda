import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { CashAuditListDataset } from "../../../reports/types/cash-report.types";

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

const buildHeader = (dataset: CashAuditListDataset): Content => ({
  margin: [0, 0, 0, 16],
  stack: [
    { text: "Reporte de arqueos de caja", style: "title" },
    {
      text: `Tenant: ${dataset.filters.tenantId}  |  Rol: ${dataset.filters.actorRole}`,
      style: "meta",
    },
    {
      text: `Sucursal: ${dataset.filters.branchId ?? "Todas"}  |  Desde: ${
        dataset.filters.dateFrom ? formatDateTime(dataset.filters.dateFrom) : "-"
      }  |  Hasta: ${dataset.filters.dateTo ? formatDateTime(dataset.filters.dateTo) : "-"}`,
      style: "meta",
    },
  ],
});

const buildSummary = (dataset: CashAuditListDataset): Content => ({
  margin: [0, 0, 0, 14],
  table: {
    widths: ["*", "*", "*", "*"],
    body: [
      [
        { text: `Arqueos\n${dataset.summary.count}`, style: "summaryCard" },
        { text: `Contado\n${formatCurrency(dataset.summary.countedAmount)}`, style: "summaryCard" },
        { text: `Esperado\n${formatCurrency(dataset.summary.expectedAmount)}`, style: "summaryCard" },
        { text: `Diferencia\n${formatCurrency(dataset.summary.difference)}`, style: "summaryCard" },
      ] as TableCell[],
    ],
  },
  layout: "noBorders",
});

const buildTable = (dataset: CashAuditListDataset): Content => ({
  table: {
    headerRows: 1,
    widths: [60, 60, 60, 65, "*", 55],
    body: [
      [
        { text: "Fecha", style: "tableHeader" },
        { text: "Caja", style: "tableHeader" },
        { text: "Contado", style: "tableHeader" },
        { text: "Esperado", style: "tableHeader" },
        { text: "Responsable", style: "tableHeader" },
        { text: "Dif.", style: "tableHeader" },
      ] as TableCell[],
      ...dataset.rows.map(
        (row) =>
          [
            { text: formatDateTime(row.countedAt) },
            {
              stack: [
                { text: row.cashRegister ?? row.cashSessionId, bold: true },
                { text: row.branchName ?? row.branchId, fontSize: 8, color: "#475569" },
              ],
            },
            { text: formatCurrency(row.countedAmount), alignment: "right" },
            { text: formatCurrency(row.expectedAmount), alignment: "right" },
            { text: row.countedBy ?? row.countedByUserId },
            { text: formatCurrency(row.difference), alignment: "right" },
          ] as TableCell[]
      ),
    ],
  },
  layout: "lightHorizontalLines",
});

export const buildCashAuditsReportLayout = (
  dataset: CashAuditListDataset
): TDocumentDefinitions => ({
  pageSize: "A4",
  pageMargins: [28, 30, 28, 30],
  content: [buildHeader(dataset), buildSummary(dataset), buildTable(dataset)],
  styles: {
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
