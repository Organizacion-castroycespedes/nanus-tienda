import type { Content } from "pdfmake/interfaces";
import type { PosSaleCancelTicketDataset } from "../../../reports/types/sales-report.types";
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

export const buildSaleCancelTicketTemplate = (
  dataset: PosSaleCancelTicketDataset
) =>
  buildThermalDocument({
    title: dataset.header.tenantName ?? "POS",
    subtitle: dataset.header.branch ?? "Sucursal",
    metadata: [
      { label: "Documento", value: "Ticket de cancelaci\u00f3n" },
      { label: "Venta original", value: dataset.cancellation.originalSaleId },
      { label: "Fecha venta", value: formatDate(dataset.header.originalDate) },
      {
        label: "Fecha cancelaci\u00f3n",
        value: formatDate(dataset.header.cancelledAt),
      },
      { label: "Cliente", value: dataset.header.customer },
      { label: "Usuario", value: dataset.header.cashier },
      { label: "Estado final", value: dataset.cancellation.finalStatus },
    ],
    sections: [
      {
        stack: [
          buildThermalSectionTitle("Pagos revertidos"),
          ...(dataset.paymentsReverted.length > 0
            ? dataset.paymentsReverted.map(
                (payment): Content => ({
                  columns: [
                    {
                      width: "*",
                      stack: [
                        { text: payment.method, bold: true, fontSize: 8.5 },
                        {
                          text: `${payment.status} | ${formatDate(payment.date)}`,
                          fontSize: 8,
                          color: "#475569",
                        },
                      ],
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
            : [{ text: "No hubo devoluciones monetarias", fontSize: 8.5 }]),
        ],
      },
      {
        stack: [
          buildThermalSectionTitle("Movimientos de caja"),
          ...(dataset.cashMovements.length > 0
            ? dataset.cashMovements.map(
                (movement): Content => ({
                  stack: [
                    {
                      columns: [
                        {
                          width: "*",
                          text: movement.cashRegister ?? movement.cashSessionId ?? "Caja",
                          fontSize: 8.5,
                          bold: true,
                        },
                        {
                          width: "auto",
                          text: formatCurrency(movement.amount),
                          fontSize: 8.5,
                          alignment: "right",
                        },
                      ],
                    },
                    {
                      text: `${formatDate(movement.date)} | ${
                        movement.description ?? "Egreso por cancelaci\u00f3n"
                      }`,
                      fontSize: 8,
                      color: "#475569",
                    },
                  ],
                  margin: [0, 0, 0, 4],
                })
              )
            : [{ text: "Sin egresos de caja asociados", fontSize: 8.5 }]),
        ],
      },
      {
        text: `Motivo: ${dataset.cancellation.reason ?? "Sin motivo registrado"}`,
        fontSize: 8.5,
      },
    ],
    totals: [
      { label: "Total venta", value: formatCurrency(dataset.totals.saleTotal) },
      { label: "Pagado", value: formatCurrency(dataset.totals.paid) },
      { label: "Reintegrado", value: formatCurrency(dataset.totals.refunded) },
      { label: "Saldo final", value: formatCurrency(dataset.totals.balance) },
    ],
  });
