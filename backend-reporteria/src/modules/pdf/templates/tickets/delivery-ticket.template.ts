import type { Content } from "pdfmake/interfaces";
import type { DeliveryTicketDataset } from "../../../reports/types/deliveries-report.types";
import {
  buildThermalDocument,
  buildThermalSectionTitle,
} from "../base/thermal-layout";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const shortId = (value: string | null | undefined) =>
  value ? value.slice(0, 8).toUpperCase() : "N/A";

const sourceSection = (dataset: DeliveryTicketDataset): Content => ({
  stack: [
    buildThermalSectionTitle("Referencias"),
    {
      text: `Pedido: ${shortId(dataset.source.orderId)}${
        dataset.source.orderStatus ? ` / ${dataset.source.orderStatus}` : ""
      }`,
    },
    {
      text: `Venta/factura: ${shortId(dataset.source.saleId)}${
        dataset.source.saleStatus ? ` / ${dataset.source.saleStatus}` : ""
      }`,
    },
    ...(dataset.source.salePaymentStatus
      ? [{ text: `Estado pago venta: ${dataset.source.salePaymentStatus}` }]
      : []),
  ],
});

const notesSection = (dataset: DeliveryTicketDataset): Content => ({
  stack: [
    buildThermalSectionTitle("Notas"),
    { text: dataset.notes || "Sin notas registradas." },
  ],
});

export const buildDeliveryTicketTemplate = (dataset: DeliveryTicketDataset) =>
  buildThermalDocument({
    title: dataset.header.tenantName ?? "Domicilios",
    subtitle: dataset.header.branchName ?? "Ticket operativo",
    metadata: [
      { label: "Documento", value: "Ticket domicilio no fiscal" },
      { label: "Domicilio", value: dataset.header.deliveryNumber || shortId(dataset.header.deliveryId) },
      { label: "Estado", value: dataset.header.status },
      { label: "Creado", value: formatDate(dataset.header.createdAt) },
      { label: "Despachado", value: formatDate(dataset.header.dispatchedAt) },
      { label: "Entregado", value: formatDate(dataset.header.deliveredAt) },
      { label: "Cliente", value: dataset.customer.name ?? "N/A" },
      { label: "Documento cliente", value: dataset.customer.documentNumber ?? "N/A" },
      { label: "Telefono", value: dataset.customer.phone ?? "N/A" },
      { label: "Direccion", value: dataset.address.value },
      { label: "Referencia", value: dataset.address.reference ?? "N/A" },
      {
        label: "Repartidor",
        value: dataset.driver
          ? [dataset.driver.name, dataset.driver.phone].filter(Boolean).join(" - ")
          : "Sin repartidor",
      },
      {
        label: "Metodo pago",
        value: dataset.payment
          ? [dataset.payment.methodName, dataset.payment.methodType]
              .filter(Boolean)
              .join(" - ")
          : "N/A",
      },
      { label: "Creado por", value: dataset.createdByUserId ?? "N/A" },
      { label: "Actualizado por", value: dataset.updatedByUserId ?? "N/A" },
    ],
    sections: [
      sourceSection(dataset),
      notesSection(dataset),
      {
        stack: [
          buildThermalSectionTitle("Aviso"),
          {
            text:
              "Documento operativo/logistico. No reemplaza factura fiscal ni registra pagos.",
          },
        ],
      },
    ],
    totals: [
      {
        label: "Subtotal origen",
        value: formatCurrency(dataset.totals.sourceSubtotal),
      },
      {
        label: "Valor domicilio",
        value: formatCurrency(dataset.totals.deliveryFee),
      },
      {
        label: "Total operativo",
        value: formatCurrency(dataset.totals.total),
      },
    ],
    footerText: "Ticket operativo de domicilio. No fiscal.",
  });
