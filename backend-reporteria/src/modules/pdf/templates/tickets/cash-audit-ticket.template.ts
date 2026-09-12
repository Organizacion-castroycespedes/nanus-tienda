import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  buildThermalDocument,
  buildThermalSectionTitle,
} from "../base/thermal-layout";
import type { CashAuditTicketDataset } from "../../../reports/types/cash-report.types";

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

const buildRowsTable = (rows: Array<[string, string]>): Content => ({
  table: {
    widths: ["*", "auto"],
    body: rows.map(
      (row) =>
        [
          { text: row[0], fontSize: 8.5 },
          { text: row[1], alignment: "right", fontSize: 8.5 },
        ] as TableCell[]
    ),
  },
  layout: "noBorders",
});

export const buildCashAuditTicketTemplate = (
  dataset: CashAuditTicketDataset
): TDocumentDefinitions =>
  buildThermalDocument({
    title: "Ticket de arqueo de caja",
    subtitle: dataset.header.tenantName ?? undefined,
    metadata: [
      { label: "Sucursal", value: dataset.header.branchName ?? dataset.header.branchId },
      { label: "Caja", value: dataset.header.cashRegister ?? dataset.header.cashSessionId },
      { label: "Sesion", value: dataset.header.cashSessionId },
      { label: "Arqueo", value: dataset.header.cashCountId },
      { label: "Responsable", value: dataset.header.countedBy ?? dataset.header.countedByUserId },
      { label: "Fecha", value: formatDateTime(dataset.header.countedAt) },
      { label: "Estado sesion", value: dataset.header.sessionStatus },
    ],
    sections: [
      {
        stack: [
          buildThermalSectionTitle("Resultado"),
          buildRowsTable([
            ["Contado", formatCurrency(dataset.audit.countedAmount)],
            ["Esperado", formatCurrency(dataset.audit.expectedAmount)],
            ["Diferencia", formatCurrency(dataset.audit.difference)],
          ]),
        ],
      },
      {
        stack: [
          buildThermalSectionTitle("Contexto de sesion"),
          buildRowsTable([
            ["Apertura", formatCurrency(dataset.sessionTotals.openingAmount)],
            ["Ventas POS", formatCurrency(dataset.sessionTotals.posSalesPayments)],
            ["Ventas pedidos", formatCurrency(dataset.sessionTotals.orderSalesPayments)],
            ["Refunds", formatCurrency(dataset.sessionTotals.refundPayments)],
          ]),
        ],
      },
      ...(dataset.audit.notes
        ? [
            {
              stack: [
                buildThermalSectionTitle("Notas"),
                { text: dataset.audit.notes, fontSize: 8.5 },
              ],
            } as Content,
          ]
        : []),
    ],
    totals: [
      { label: "Esperado", value: formatCurrency(dataset.audit.expectedAmount) },
      { label: "Contado", value: formatCurrency(dataset.audit.countedAmount) },
      { label: "Diferencia", value: formatCurrency(dataset.audit.difference) },
    ],
    footerText: "Documento de arqueo de caja.",
  });
