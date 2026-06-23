import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  buildThermalDocument,
  buildThermalSectionTitle,
} from "../base/thermal-layout";
import type { CashClosingTicketDataset } from "../../../reports/types/cash-report.types";

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

const buildMiniTable = (rows: Array<[string, string]>): Content => ({
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

const paymentCategoryLabel: Record<string, string> = {
  CASH: "EFECTIVO",
  CARD: "TARJETA",
  TRANSFER: "TRANSFERENCIA",
  DIGITAL: "DIGITAL",
  OTHER: "OTRO",
};

export const buildCashClosingTicketTemplate = (
  dataset: CashClosingTicketDataset
): TDocumentDefinitions => {
  const metadata = [
    { label: "Sucursal", value: dataset.header.branchName ?? dataset.header.branchId },
    { label: "Caja", value: dataset.header.cashRegister ?? dataset.header.cashSessionId },
    { label: "Sesion", value: dataset.header.cashSessionId },
    { label: "Terminal", value: dataset.header.terminal ?? "-" },
    { label: "Estado", value: dataset.header.status },
    { label: "Apertura", value: formatDateTime(dataset.header.openedAt) },
    { label: "Cierre", value: formatDateTime(dataset.header.closedAt) },
    { label: "Abierta por", value: dataset.header.openedBy ?? dataset.header.openedByUserId },
    { label: "Cerrada por", value: dataset.header.closedBy ?? "-" },
  ];

  const sections: Content[] = [
    {
      stack: [
        buildThermalSectionTitle("Resumen"),
        buildMiniTable([
          ["Ventas POS", formatCurrency(dataset.totals.posSalesPayments)],
          ["Ventas pedidos", formatCurrency(dataset.totals.orderSalesPayments)],
          ["Refunds", formatCurrency(dataset.totals.refundPayments)],
          ["Compras", formatCurrency(dataset.totals.purchasePayments)],
          ["Egresos", formatCurrency(dataset.totals.expenses + dataset.totals.withdrawals)],
          ["Ajustes OUT", formatCurrency(dataset.totals.adjustmentsOut)],
        ]),
      ],
    },
  ];
  const cashControl = dataset.cashControl;
  const sourceBreakdown = dataset.sourceBreakdown;

  const paymentBreakdownRows = dataset.paymentBreakdown
    .filter((item) => item.direction === "IN" && item.total > 0)
    .map(
      (item) =>
        [item.paymentMethodNombre.toUpperCase(), formatCurrency(item.total)] as [string, string]
    );

  const deliveryBreakdownRows = dataset.deliverySummary.byPaymentMethod.map(
    (item) =>
      [
        item.paymentMethodNombre?.toUpperCase() ?? "SIN METODO",
        `${item.count} / ${formatCurrency(item.total)}`,
      ] as [string, string]
  );

  if (cashControl) {
    sections.push({
      stack: [
        buildThermalSectionTitle("Resumen efectivo"),
        buildMiniTable([
          ["Apertura efectivo", formatCurrency(cashControl.openingCash)],
          ["Ingresos efectivo", formatCurrency(cashControl.cashPaymentsIn)],
          ["Domicilios efectivo", formatCurrency(cashControl.cashDeliveryFees)],
          ["Salidas efectivo", formatCurrency(cashControl.cashPaymentsOut + cashControl.cashManualOut)],
          ["Esperado caja", formatCurrency(cashControl.expectedCashAmount)],
          ["Contado", formatCurrency(cashControl.countedCashAmount ?? dataset.totals.closingAmount)],
          ["Diferencia", formatCurrency(cashControl.differenceAmount ?? dataset.totals.difference)],
        ]),
      ],
    });
  }

  if (sourceBreakdown) {
    sections.push({
      stack: [
        buildThermalSectionTitle("Resumen operativo"),
        buildMiniTable([
          ["Ventas POS", formatCurrency(sourceBreakdown.posSales)],
          ["Pedidos", formatCurrency(sourceBreakdown.orders)],
          ["Compras", formatCurrency(sourceBreakdown.purchases)],
          ["Domicilios", formatCurrency(sourceBreakdown.deliveries)],
          ["Movimientos IN", formatCurrency(sourceBreakdown.manualIn)],
          ["Movimientos OUT", formatCurrency(sourceBreakdown.manualOut)],
          ["Arqueos realizados", String(dataset.auditSummary?.auditCount ?? 0)],
        ]),
      ],
    });
  }

  const methodRows = (dataset.paymentMethodDetails ?? []).map(
    (item) =>
      [
        `${item.paymentMethodNombre.toUpperCase()} (${paymentCategoryLabel[item.category] ?? item.category})`,
        formatCurrency(item.net),
      ] as [string, string]
  );

  if (methodRows.length > 0) {
    sections.push({
      stack: [
        buildThermalSectionTitle("Resumen por medio de pago"),
        buildMiniTable(methodRows),
      ],
    });
  }

  if (dataset.lastCount) {
    sections.push({
      stack: [
        buildThermalSectionTitle("Ultimo arqueo"),
        buildMiniTable([
          ["Fecha", formatDateTime(dataset.lastCount.countedAt)],
          ["Contado", formatCurrency(dataset.lastCount.countedCashAmount)],
          ["Esperado", formatCurrency(dataset.lastCount.expectedAmount)],
          ["Diferencia", formatCurrency(dataset.lastCount.differenceAmount)],
        ]),
      ],
    });
  }

  sections.push({
    stack: [
      buildThermalSectionTitle("Movimientos"),
      buildMiniTable(
        dataset.movementBreakdown.map((item) => [
          `${item.movementType} ${item.direction}`,
          `${item.count} / ${formatCurrency(item.total)}`,
        ])
      ),
    ],
  });

  sections.push({
    stack: [
      buildThermalSectionTitle("Domicilios"),
      buildMiniTable([
        ["Entregados", String(dataset.deliverySummary.deliveredCount)],
        ["Pendientes/despachados", String(dataset.deliverySummary.pendingCount)],
        ["Cancelados/no entregados", String(dataset.deliverySummary.excludedCount)],
        ["Total valor domicilio", formatCurrency(dataset.deliverySummary.deliveredFeeTotal)],
      ]),
      ...(deliveryBreakdownRows.length > 0
        ? [buildMiniTable(deliveryBreakdownRows)]
        : []),
    ],
  });

  if (methodRows.length === 0 && paymentBreakdownRows.length > 0) {
    sections.push({
      stack: [
        buildThermalSectionTitle("Resumen por medio de pago"),
        buildMiniTable(paymentBreakdownRows),
      ],
    });
  }

  return buildThermalDocument({
    title: "Ticket de cierre de caja",
    subtitle: dataset.header.tenantName ?? undefined,
    metadata,
    sections,
    totals: [
      ["Apertura", formatCurrency(dataset.totals.openingAmount)],
      ["Entradas", formatCurrency(dataset.totals.totalIn)],
      ["Salidas", formatCurrency(dataset.totals.totalOut)],
      ["Efectivo esperado", formatCurrency(dataset.totals.expectedAmount)],
      ["Efectivo contado", formatCurrency(dataset.totals.closingAmount)],
      ["Diferencia", formatCurrency(dataset.totals.difference)],
    ].map(([label, value]) => ({ label, value })),
    footerText: "Documento de cierre generado por backend-reporteria.",
  });
};
