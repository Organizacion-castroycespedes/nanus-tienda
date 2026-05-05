import type { Content, TableCell } from "pdfmake/interfaces";
import type { OrderSaleTicketDataset } from "../../../reports/types/orders-report.types";
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

export const buildOrderSaleTicketTemplate = (dataset: OrderSaleTicketDataset) =>
  buildThermalDocument({
    title: dataset.header.tenantName ?? "Pedidos",
    subtitle: dataset.header.branchName ?? "Sucursal",
    metadata: [
      { label: "Documento", value: "Ticket pedido" },
      { label: "Pedido", value: dataset.header.orderId },
      { label: "Fecha", value: formatDate(dataset.header.date) },
      { label: "Cliente", value: dataset.header.customerName },
      {
        label: "Estado",
        value: `${dataset.header.status} / ${dataset.header.paymentStatus}`,
      },
    ],
    sections: [
      {
        stack: [
          buildThermalSectionTitle("Ventas generadas"),
          ...(dataset.generatedSales.length > 0
            ? dataset.generatedSales.map(
                (sale): Content => ({
                  stack: [
                    {
                      text: `${sale.saleId} · ${formatDate(sale.date)}`,
                      bold: true,
                    },
                    {
                      text: `${sale.status} / ${sale.paymentStatus} · ${formatCurrency(
                        sale.total
                      )}`,
                      color: "#475569",
                    },
                  ],
                  margin: [0, 0, 0, 4],
                })
              )
            : [{ text: "Sin ventas generadas", fontSize: 8.5 }]),
        ],
      },
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
                            text: `${item.orderedQuantity} ord. · ${item.deliveredQuantity} entr. · ${item.billedQuantity} fact.`,
                            color: "#475569",
                          },
                        ],
                      },
                      { text: formatCurrency(item.subtotal), alignment: "right" },
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
          ...(dataset.payments.length > 0
            ? dataset.payments.map(
                (payment): Content => ({
                  columns: [
                    {
                      width: "*",
                      text: `${payment.method} · ${payment.source}`,
                      fontSize: 8.5,
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
    ],
    totals: [
      { label: "Total", value: formatCurrency(dataset.totals.total) },
      { label: "Pagado", value: formatCurrency(dataset.totals.paid) },
      { label: "Saldo", value: formatCurrency(dataset.totals.balance) },
    ],
  });
