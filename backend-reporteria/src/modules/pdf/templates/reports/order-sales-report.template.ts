import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { OrderSalesListDataset } from "../../../reports/types/orders-report.types";
import { REPORT_TIME_ZONE, formatReportDateTime } from "../../../reports/report-date-range";

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
        timeZone: REPORT_TIME_ZONE,
      }).format(new Date(value))
    : "N/A";

const buildHeader = (dataset: OrderSalesListDataset): Content => ({
  margin: [0, 0, 0, 12],
  columns: [
    (() => {
      const logo = dataset.branding?.logo;
      if (logo && /^data:image\/(png|jpeg);base64,/i.test(logo)) return { image: logo, width: 56, height: 42 };
      if (logo && /^data:image\/svg\+xml;base64,/i.test(logo)) {
        const svg = Buffer.from(logo.split(",", 2)[1], "base64").toString("utf8");
        if (svg.includes("<svg")) return { svg, width: 56, height: 42 };
      }
      return { text: "", width: 56 };
    })(),
    {
      width: "*",
      stack: [
        { text: dataset.branding?.legalName ?? dataset.branding?.tenantName ?? "", style: "title" },
        { text: dataset.branding?.nit ? `NIT ${dataset.branding.nit}` : "", style: "meta" },
        { text: [dataset.branding?.address, dataset.branding?.phone, dataset.branding?.email].filter(Boolean).join(" | "), style: "meta" },
        { text: "Reporte de pedidos", style: "reportTitle" },
        { text: `Zona: ${REPORT_TIME_ZONE} | Generado: ${formatReportDateTime(new Date())}`, style: "meta" },
      ],
    },
  ],
});

export const buildOrderSalesReportLayout = (
  dataset: OrderSalesListDataset
): TDocumentDefinitions => ({
  pageSize: "A4",
  pageOrientation: "landscape",
  pageMargins: [32, 32, 32, 32],
  content: [
    buildHeader(dataset),
    { margin: [0, 0, 0, 10], text: `Tenant: ${dataset.branding?.tenantName ?? dataset.filters.tenantId} | Sucursal: ${dataset.branding?.branchName ?? dataset.filters.branchId ?? "Todas"} | Desde: ${formatDate(dataset.filters.dateFrom)} | Hasta: ${formatDate(dataset.filters.dateTo)}`, style: "meta" },
    {
      margin: [0, 0, 0, 16],
      columns: [
        { width: "*", text: `Pedidos: ${dataset.summary.count}`, style: "summary" },
        { width: "*", text: `Total: ${formatCurrency(dataset.summary.total)}`, style: "summary" },
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
        dontBreakRows: true,
        keepWithHeaderRows: 1,
        widths: [76, "*", 110, 112, 82, 82, 82],
        body: [
          [
            { text: "Pedido", style: "tableHeader" },
            { text: "Cliente", style: "tableHeader" },
            { text: "Venta generada", style: "tableHeader" },
            { text: "Estado", style: "tableHeader" },
            { text: "Total", style: "tableHeader", alignment: "right" },
            { text: "Pagado", style: "tableHeader", alignment: "right" },
            { text: "Saldo", style: "tableHeader", alignment: "right" },
          ] as TableCell[],
          ...dataset.rows.map(
            (row) =>
              [
                {
                  stack: [
                    row.orderId,
                    { text: formatDate(row.date), color: "#475569" },
                  ],
                },
                row.customerName,
                row.generatedSaleId ?? "-",
                `${row.status} / ${row.paymentStatus}`,
                { text: formatCurrency(row.total), alignment: "right" },
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
    title: { fontSize: 13, bold: true },
    reportTitle: { fontSize: 13, bold: true, margin: [0, 8, 0, 0] },
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
