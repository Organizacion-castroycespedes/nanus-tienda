import type { Content, TableCell } from "pdfmake/interfaces";
import type { PurchaseTicketDataset } from "../../../reports/types/purchases-report.types";
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

export const buildPurchaseTicketTemplate = (dataset: PurchaseTicketDataset) =>
  buildThermalDocument({
    title: dataset.header.tenantName ?? "Compras",
    subtitle: dataset.header.branchName ?? "Sucursal",
    metadata: [
      { label: "Documento", value: "Ticket de compra" },
      { label: "Compra", value: dataset.header.purchaseId },
      { label: "Fecha", value: formatDate(dataset.header.date) },
      { label: "Proveedor", value: dataset.header.supplier },
      { label: "Usuario", value: dataset.header.userName ?? "N/A" },
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
                            text: `${item.quantity} x ${formatCurrency(item.unitCost)}`,
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
                      text: `${payment.method} (${payment.status})`,
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
