import type { Content, TableCell } from "pdfmake/interfaces";
import type { PosSaleTicketDataset, PrintableCompanyHeader } from "../../../reports/types/sales-report.types";
import {
  addPdfSoftBreaks,
  buildThermalDocument,
  buildThermalSectionTitle,
  THERMAL_80MM_LAYOUT,
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

type PosSalePdfDataset = PosSaleTicketDataset & { company?: PrintableCompanyHeader | null };

export const buildPosSaleTicketTemplate = (dataset: PosSalePdfDataset) =>
  buildThermalDocument({
    title: dataset.company?.legalName ?? dataset.header.tenantName ?? "POS",
    subtitle: dataset.company?.branchName ?? dataset.header.branch ?? "Sucursal",
    logo: dataset.company?.logo,
    metadata: [
      { label: "Documento", value: "Ticket de venta" },
      ...(dataset.company?.nit
        ? [{ label: "NIT", value: `${dataset.company.nit}${dataset.company.dv ? `-${dataset.company.dv}` : ""}` }]
        : []),
      ...(dataset.company?.address ? [{ label: "Dirección", value: dataset.company.address }] : []),
      ...(dataset.company?.phone ? [{ label: "Teléfono", value: dataset.company.phone }] : []),
      ...(dataset.company?.email ? [{ label: "Correo", value: dataset.company.email }] : []),
      { label: "Fecha", value: formatDate(dataset.header.date) },
      { label: "Cliente", value: dataset.header.customer },
      { label: "Cajero", value: dataset.header.cashier },
    ],
    sections: [
      {
        stack: [
          buildThermalSectionTitle("Items"),
          {
            table: {
              widths: ["*", THERMAL_80MM_LAYOUT.itemAmountColumnWidthPt],
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
                          {
                            text: addPdfSoftBreaks(item.productName),
                            bold: true,
                          },
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
                      width: THERMAL_80MM_LAYOUT.safeContentWidthPt -
                        THERMAL_80MM_LAYOUT.itemAmountColumnWidthPt,
                      text: payment.method,
                      fontSize: 8.5,
                      bold: true,
                    },
                    {
                      width: THERMAL_80MM_LAYOUT.itemAmountColumnWidthPt,
                      text: formatCurrency(payment.amount),
                      fontSize: 8.5,
                      alignment: "right",
                    },
                  ],
                })
              )
            : [{
                text: dataset.totals.paid > 0
                  ? "Detalle de pago no disponible"
                  : "Sin pagos registrados",
                fontSize: 8.5,
              }]),
        ],
      },
    ],
    totals: [
      { label: "Subtotal", value: formatCurrency(dataset.totals.subtotal) },
      ...(
        dataset.totals.taxBreakdown && dataset.totals.taxBreakdown.length > 0
          ? dataset.totals.taxBreakdown.map((tax) => ({
              label: tax.label,
              value: formatCurrency(tax.taxAmount),
            }))
          : [{ label: "Impuestos", value: formatCurrency(dataset.totals.taxes) }]
      ),
      { label: "Total", value: formatCurrency(dataset.totals.total) },
      { label: "Pagado", value: formatCurrency(dataset.totals.paid) },
      { label: "Cambio", value: formatCurrency(dataset.totals.change) },
      { label: "Saldo", value: formatCurrency(dataset.totals.balance) },
    ],
  });
