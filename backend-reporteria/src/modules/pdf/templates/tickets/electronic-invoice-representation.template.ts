import type { Content, TableCell } from "pdfmake/interfaces";
import type { ElectronicInvoiceRepresentation } from "../../../reports/types/electronic-invoice-representation.types";
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

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "N/A";

const partyRows = (label: string, party: ElectronicInvoiceRepresentation["customer"]) => [
  buildThermalSectionTitle(label),
  { text: addPdfSoftBreaks(party.name) },
  ...(party.identificationType && party.identificationNumber
    ? [{ text: `${party.identificationType}: ${addPdfSoftBreaks(party.identificationNumber)}` }]
    : []),
  ...(party.address ? [{ text: addPdfSoftBreaks(party.address) }] : []),
  ...(party.country ? [{ text: `País: ${addPdfSoftBreaks(party.country)}` }] : []),
  ...(party.department
    ? [{ text: `Departamento: ${addPdfSoftBreaks(party.department)}` }]
    : []),
  ...(party.municipality
    ? [{ text: `Municipio: ${addPdfSoftBreaks(party.municipality)}` }]
    : []),
  ...(party.phone ? [{ text: `Teléfono: ${addPdfSoftBreaks(party.phone)}` }] : []),
  ...(party.email ? [{ text: `Correo: ${addPdfSoftBreaks(party.email)}` }] : []),
];

export const buildElectronicInvoiceRepresentationTemplate = (
  representation: ElectronicInvoiceRepresentation
) =>
  buildThermalDocument({
    title: "Factura electrónica",
    subtitle: representation.issuer.name,
    logo: representation.logo,
    metadata: [
      { label: "Estado", value: "Aceptada" },
      { label: "Número", value: representation.invoice.number },
      { label: "Fecha emisión", value: formatDate(representation.invoice.issuedAt) },
      { label: "Fecha aceptación", value: formatDate(representation.invoice.acceptedAt) },
      ...(representation.invoice.cufe
        ? [{ label: "CUFE", value: representation.invoice.cufe }]
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
                          { text: addPdfSoftBreaks(item.productName), bold: true },
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
          ...(representation.sale.paymentBreakdown?.length
            ? representation.sale.paymentBreakdown.map((payment): Content => ({
                columns: [
                  { text: addPdfSoftBreaks(payment.method), bold: true },
                  { text: formatCurrency(payment.amount), alignment: "right" as const },
                ],
              }))
            : [{ text: representation.sale.paymentMethod }]),
        ],
      },
    ],
    totals: [
      { label: "Subtotal", value: formatCurrency(representation.sale.subtotal) },
      { label: "Descuentos", value: formatCurrency(representation.sale.discounts) },
      ...(
        representation.sale.taxBreakdown && representation.sale.taxBreakdown.length > 0
          ? representation.sale.taxBreakdown.map((tax) => ({
              label: tax.label,
              value: formatCurrency(tax.taxAmount),
            }))
          : [{ label: "Impuestos", value: formatCurrency(representation.sale.taxes) }]
      ),
      { label: "Total", value: formatCurrency(representation.sale.total) },
    ],
    qrPayload: representation.invoice.qrPayload,
    footerText: "Representación fiscal de factura electrónica. No reemplaza el documento XML.",
  });
