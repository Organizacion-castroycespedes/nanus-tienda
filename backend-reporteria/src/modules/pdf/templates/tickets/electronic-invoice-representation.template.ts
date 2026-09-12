import type { Content, TableCell } from "pdfmake/interfaces";
import type { ElectronicInvoiceRepresentation } from "../../../reports/types/electronic-invoice-representation.types";
import {
  addThermalSoftBreaks,
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

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "N/A";

const partyRows = (label: string, party: ElectronicInvoiceRepresentation["customer"]) => [
  buildThermalSectionTitle(label),
  { text: addThermalSoftBreaks(party.name) },
  ...(party.identificationType && party.identificationNumber
    ? [{ text: `${party.identificationType}: ${addThermalSoftBreaks(party.identificationNumber)}` }]
    : []),
  ...(party.address ? [{ text: addThermalSoftBreaks(party.address) }] : []),
  ...(party.country ? [{ text: `País: ${addThermalSoftBreaks(party.country)}` }] : []),
  ...(party.department
    ? [{ text: `Departamento: ${addThermalSoftBreaks(party.department)}` }]
    : []),
  ...(party.municipality
    ? [{ text: `Municipio: ${addThermalSoftBreaks(party.municipality)}` }]
    : []),
];

export const buildElectronicInvoiceRepresentationTemplate = (
  representation: ElectronicInvoiceRepresentation
) =>
  buildThermalDocument({
    title: "Factura electrónica",
    subtitle: representation.issuer.name,
    metadata: [
      { label: "Estado", value: "Aceptada" },
      { label: "Número", value: representation.invoice.number },
      { label: "Fecha emisión", value: formatDate(representation.invoice.issuedAt) },
      { label: "Fecha aceptación", value: formatDate(representation.invoice.acceptedAt) },
      ...(representation.invoice.cufe
        ? [{ label: "CUFE", value: representation.invoice.cufe }]
        : []),
      ...(representation.invoice.providerStatusCode
        ? [{ label: "Código", value: representation.invoice.providerStatusCode }]
        : []),
      ...(representation.invoice.providerStatusMessage
        ? [{ label: "Respuesta", value: representation.invoice.providerStatusMessage }]
        : []),
      ...(representation.invoice.trackingId
        ? [{ label: "Referencia", value: representation.invoice.trackingId }]
        : []),
    ],
    sections: [
      { stack: partyRows("Emisor", representation.issuer) as Content[] },
      { stack: partyRows("Cliente", representation.customer) as Content[] },
      {
        stack: [
          buildThermalSectionTitle("Detalle"),
          {
            table: {
              widths: ["*", THERMAL_80MM_LAYOUT.itemAmountColumnWidthPt],
              body: [
                [
                  { text: "Item", style: "tableHeader" },
                  { text: "Total", style: "tableHeader", alignment: "right" },
                ] as TableCell[],
                ...representation.sale.items.map(
                  (item) =>
                    [
                      {
                        stack: [
                          { text: addThermalSoftBreaks(item.productName), bold: true },
                          {
                            text: `${item.quantity} x ${formatCurrency(item.unitValue)}`,
                            color: "#475569",
                          },
                        ],
                      },
                      { text: formatCurrency(item.total), alignment: "right" },
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
          buildThermalSectionTitle("Pago"),
          { text: representation.sale.paymentMethod },
        ],
      },
    ],
    totals: [
      { label: "Subtotal", value: formatCurrency(representation.sale.subtotal) },
      { label: "Descuentos", value: formatCurrency(representation.sale.discounts) },
      { label: "Impuestos", value: formatCurrency(representation.sale.taxes) },
      { label: "Total", value: formatCurrency(representation.sale.total) },
    ],
    footerText: "Representación fiscal de factura electrónica. No reemplaza el documento XML.",
  });
