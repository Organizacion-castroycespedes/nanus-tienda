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

const isClosedPartial = (dataset: PurchaseTicketDataset) =>
  dataset.header.status === "CERRADA_PARCIAL";

const buildLiquidationMetadata = (dataset: PurchaseTicketDataset) =>
  isClosedPartial(dataset)
    ? [
        {
          label: "Motivo liquidacion",
          value: dataset.header.motivoLiquidacion ?? "N/A",
        },
        {
          label: "Fecha liquidacion",
          value: formatDate(dataset.header.liquidadoEn),
        },
        {
          label: "Usuario liquido",
          value:
            dataset.header.liquidadoPorNombre ??
            dataset.header.liquidadoPor ??
            "N/A",
        },
      ]
    : [];

export const buildPurchaseTicketTemplate = (dataset: PurchaseTicketDataset) => {
  const liquidationTotals = isClosedPartial(dataset)
    ? [
        {
          label: "Total pedido",
          value: formatCurrency(dataset.totals.totalPedido ?? dataset.totals.total),
        },
        {
          label: "Total recibido/liquidado",
          value: formatCurrency(
            dataset.totals.totalLiquidado ??
              dataset.totals.totalRecibido ??
              dataset.totals.total
          ),
        },
        {
          label: "Diferencia no recibida",
          value: formatCurrency(dataset.totals.diferenciaNoRecibida ?? 0),
        },
      ]
    : [];

  return buildThermalDocument({
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
      ...buildLiquidationMetadata(dataset),
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
                            text: `Pedida: ${item.quantity} | Recibida: ${item.receivedQuantity} | No recibida: ${item.unreceivedQuantity ?? Math.max(item.quantity - item.receivedQuantity, 0)}`,
                            color: "#475569",
                          },
                          {
                            text: `Costo unitario: ${formatCurrency(item.unitCost)}`,
                            color: "#475569",
                          },
                          ...(isClosedPartial(dataset)
                            ? [
                                {
                                  text: `Subtotal recibido: ${formatCurrency(item.receivedSubtotal ?? item.receivedQuantity * item.unitCost)}`,
                                  color: "#475569",
                                },
                                {
                                  text: `Subtotal no recibido: ${formatCurrency(item.unreceivedSubtotal ?? Math.max(item.quantity - item.receivedQuantity, 0) * item.unitCost)}`,
                                  color: "#475569",
                                },
                              ]
                            : []),
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
      ...liquidationTotals,
      { label: "Total", value: formatCurrency(dataset.totals.total) },
      { label: "Pagado", value: formatCurrency(dataset.totals.paid) },
      { label: "Saldo", value: formatCurrency(dataset.totals.balance) },
    ],
  });
};
