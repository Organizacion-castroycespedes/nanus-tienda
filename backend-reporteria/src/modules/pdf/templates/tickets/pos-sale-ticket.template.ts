import type { Content, TableCell } from "pdfmake/interfaces";
import type { PosSaleTicketDataset } from "../../../reports/types/sales-report.types";
import {
  buildThermalDocument,
  buildThermalSectionTitle,
} from "../base/thermal-layout";

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

export const buildPosSaleTicketTemplate = (dataset: PosSaleTicketDataset) =>
  buildThermalDocument({
    title: dataset.header.tenantName ?? "POS",
    subtitle: dataset.header.branch ?? "Sucursal",
    metadata: [
      { label: "Documento", value: "Ticket de venta" },
      { label: "Venta", value: dataset.header.saleId },
      { label: "Fecha", value: formatDate(dataset.header.date) },
      { label: "Cliente", value: dataset.header.customer },
      { label: "Cajero", value: dataset.header.cashier },
      { label: "Terminal", value: dataset.header.terminal ?? "N/A" },
      {
        label: "Estado",
        value: `${dataset.header.status} / ${dataset.header.paymentStatus}`,
      },
    ],
    sections: [
      {
        stack: [
          buildThermalSectionTitle("Items"),
          {
            table: {
              widths: ["*", "auto"],
              body: [
                [
                  { text: "Item", style: "tableHeader" },
                  { text: "Valor", style: "tableHeader", alignment: "right" },
                ] as TableCell[],
                ...dataset.items.map(
                  (item) =>
                    [
                      {
                        stack: [
                          { text: item.productName, bold: true },
                          {
                            text: `${item.quantity} x ${formatCurrency(item.unitPrice)}`,
                            color: "#475569",
                          },
                        ],
                      },
                      {
                        text: formatCurrency(item.subtotal),
                        alignment: "right",
                      },
                    ] as TableCell[]
                ),
              ],
            },
            layout: "lightHorizontalLines",
          },
        ],
      },
      {
        stack: [
          buildThermalSectionTitle("Pagos"),
          ...(dataset.paymentBreakdown.length > 0
            ? dataset.paymentBreakdown.map(
                (payment): Content => ({
                  columns: [
                    {
                      width: "*",
                      text: payment.method,
                      fontSize: 8.5,
                      bold: true,
                    },
                    {
                      width: "auto",
                      text: formatCurrency(payment.amount),
                      fontSize: 8.5,
                      alignment: "right",
                    },
                  ],
                })
              )
            : [{ text: "Sin pagos registrados", fontSize: 8.5 }]),
        ],
      },
      ...(dataset.cashContext
        ? [
            {
              fontSize: 8,
              stack: [
                buildThermalSectionTitle("Caja"),
                { text: `Caja: ${dataset.cashContext.cashRegister ?? "N/A"}` },
                { text: `Sesi\u00f3n: ${dataset.cashContext.cashSession ?? "N/A"}` },
                { text: `Apertura: ${formatDate(dataset.cashContext.openedAt)}` },
              ],
            } as Content,
          ]
        : []),
    ],
    totals: [
      { label: "Subtotal", value: formatCurrency(dataset.totals.subtotal) },
      { label: "Impuestos", value: formatCurrency(dataset.totals.taxes) },
      { label: "Total", value: formatCurrency(dataset.totals.total) },
      { label: "Pagado", value: formatCurrency(dataset.totals.paid) },
      { label: "Cambio", value: formatCurrency(dataset.totals.change) },
      { label: "Saldo", value: formatCurrency(dataset.totals.balance) },
    ],
  });
