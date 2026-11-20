import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { amountToPesosInWords } from "./amount-in-words";

// Identidad visual portada desde flexibuild-core (backend-documental/quotation-pdf.renderer.ts):
// portada con banda de color y franja de acento, logo o iniciales, badge de estado, tarjetas de datos,
// titulos de seccion tipo pildora, tabla con cabecera en color primario, cuadro economico con barra
// de total, total en letras, firma del representante legal y pie institucional paginado.

export type QuotationPdfStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CONVERTED" | "EXPIRED";

export type QuotationPdfDataset = {
  quotation: {
    code: string;
    status: QuotationPdfStatus;
    issueDate: string;
    validUntil: string;
    validityDays: number;
    branchName: string | null;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
    commercialTerms: string | null;
    paymentDeliveryTerms: string | null;
    warrantyTerms: string | null;
    notes: string | null;
  };
  customer: {
    name: string;
    document: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  items: Array<{
    lineNumber: number;
    productCode: string | null;
    productName: string;
    unitCode: string | null;
    quantity: number;
    finalUnitPrice: number;
    discountPercent: number;
    promotionName: string | null;
    taxRate: number;
    lineTotal: number;
  }>;
  taxes: Array<{ taxName: string; taxRate: number; taxBase: number; taxAmount: number }>;
  company: {
    name: string;
    legalName: string | null;
    nit: string | null;
    dv: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    representativeName: string | null;
    representativeDocumentType: string | null;
    representativeDocumentNumber: string | null;
    logo: string | null;
    primaryColor: string | null;
    accentColor: string | null;
  };
};

export const QUOTATION_PDF_DEFAULT_PRIMARY = "#1f3b5b";
export const QUOTATION_PDF_DEFAULT_ACCENT = "#F2C94C";

const theme = {
  secondary: "#0B1220",
  grayRow: "#e5e7eb",
  text: "#111827",
  soft: "#F3F5F7",
  line: "#C7D1DB",
  muted: "#5B6776",
  card: "#eef2f5",
  cardLine: "#d7e0e8",
  white: "#FFFFFF",
};

const STATUS_BADGES: Record<QuotationPdfStatus, { label: string; color: string }> = {
  DRAFT: { label: "BORRADOR", color: "#D97706" },
  SENT: { label: "ENVIADA", color: "#2563EB" },
  APPROVED: { label: "APROBADA", color: "#15803D" },
  REJECTED: { label: "RECHAZADA", color: "#B91C1C" },
  CONVERTED: { label: "CONVERTIDA", color: "#7C3AED" },
  EXPIRED: { label: "VENCIDA", color: "#6B7280" },
};

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const PAGE_WIDTH = 595.28; // A4
const MARGIN_X = 40;
const BAND_HEIGHT = 188;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
export const resolveColor = (value: string | null | undefined, fallback: string) =>
  value && HEX.test(value.trim()) ? value.trim() : fallback;

const currencyWhole = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const currencyCents = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quantityFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 });
const percentFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

/** Pesos sin decimales cuando el valor es entero; con centavos siempre muestra dos cifras. */
export const formatMoney = (value: number) => {
  const amount = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(amount) ? currencyWhole.format(amount) : currencyCents.format(amount);
};

export const formatLongDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
};

const text = (value: string | null | undefined, fallback = "-") =>
  value && value.trim() ? value.trim() : fallback;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "C";

const logoContent = (company: QuotationPdfDataset["company"]): Content => {
  const logo = company.logo?.trim();
  const position = { x: 44, y: 42 };
  if (logo && /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/i.test(logo)) {
    return { image: logo, fit: [132, 70], absolutePosition: position };
  }
  if (logo && /^data:image\/svg\+xml;base64,/i.test(logo)) {
    const svg = Buffer.from(logo.split(",", 2)[1] ?? "", "base64").toString("utf8");
    if (svg.includes("<svg")) {
      return { svg, fit: [132, 70], absolutePosition: position };
    }
  }
  return {
    absolutePosition: position,
    stack: [
      { canvas: [{ type: "rect", x: 0, y: 0, w: 132, h: 70, r: 12, color: "#24486c" }] },
      {
        columns: [
          {
            width: 132,
            text: initials(company.legalName ?? company.name),
            color: theme.white,
            bold: true,
            fontSize: 22,
            alignment: "center",
          },
        ],
        margin: [0, -48, 0, 0],
      },
    ],
  };
};

const coverHeader = (dataset: QuotationPdfDataset, primary: string): Content[] => {
  const badge = STATUS_BADGES[dataset.quotation.status] ?? STATUS_BADGES.DRAFT;
  const badgeWidth = 150;
  const badgeX = PAGE_WIDTH - badgeWidth - MARGIN_X;
  return [
    logoContent(dataset.company),
    {
      text: text(dataset.company.legalName, dataset.company.name),
      absolutePosition: { x: 190, y: 44 },
      color: theme.white,
      bold: true,
      fontSize: 11,
    },
    {
      text: "COTIZACIÓN",
      absolutePosition: { x: 190, y: 66 },
      color: theme.white,
      bold: true,
      fontSize: 26,
    },
    {
      text: dataset.quotation.code,
      absolutePosition: { x: 190, y: 100 },
      color: theme.white,
      bold: true,
      fontSize: 13,
    },
    {
      text: "Propuesta comercial de productos",
      absolutePosition: { x: 190, y: 118 },
      color: theme.white,
      fontSize: 9,
    },
    {
      absolutePosition: { x: badgeX, y: 42 },
      canvas: [{ type: "rect", x: 0, y: 0, w: badgeWidth, h: 28, r: 14, color: badge.color }],
    },
    {
      absolutePosition: { x: badgeX, y: 51 },
      columns: [
        {
          width: badgeWidth,
          text: `ESTADO: ${badge.label}`,
          color: theme.white,
          bold: true,
          fontSize: 10,
          alignment: "center",
        },
      ],
    },
    // Reserva el espacio de la banda (los elementos absolutos no ocupan flujo).
    { text: "", margin: [0, BAND_HEIGHT - 60 + 16, 0, 0], color: primary },
  ];
};

const infoCell = (label: string, value: string, primary: string): TableCell => ({
  fillColor: theme.card,
  margin: [10, 8, 10, 8],
  stack: [
    { text: label.toUpperCase(), bold: true, fontSize: 8, color: primary },
    { text: value, fontSize: 10, color: theme.text, margin: [0, 3, 0, 0] },
  ],
});

const cardsLayout = {
  hLineColor: () => theme.cardLine,
  vLineColor: () => theme.cardLine,
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
};

const cardColumn = (label: string, value: string, primary: string) => ({
  width: "*" as const,
  table: { widths: ["*"], body: [[infoCell(label, value, primary)]] },
  layout: cardsLayout,
});

const coverCards = (dataset: QuotationPdfDataset, primary: string): Content => {
  const { quotation, customer } = dataset;
  const customerLabel = customer.document ? `${customer.name}\n${customer.document}` : customer.name;
  const contact = [customer.phone, customer.email].filter(Boolean).join("  |  ") || "-";
  const rows: Array<[[string, string], [string, string]]> = [
    [["Cliente", customerLabel], ["Fecha de emisión", formatLongDate(quotation.issueDate)]],
    [
      ["Contacto", contact],
      ["Válida hasta", `${formatLongDate(quotation.validUntil)} (${quotation.validityDays} días)`],
    ],
    [["Dirección", text(customer.address)], ["Sucursal", text(quotation.branchName)]],
  ];
  // Una fila de columnas por par de tarjetas: ambas arrancan a la misma altura.
  return {
    margin: [0, 0, 0, 10],
    stack: rows.map(([left, right]) => ({
      columns: [
        cardColumn(left[0], left[1], primary),
        cardColumn(right[0], right[1], primary),
      ],
      columnGap: 20,
      margin: [0, 0, 0, 8],
    })),
  } as Content;
};

const sectionTitle = (title: string, primary: string): Content => ({
  unbreakable: true,
  margin: [0, 10, 0, 8],
  stack: [
    { canvas: [{ type: "rect", x: 0, y: 0, w: 180, h: 20, r: 10, color: primary }] },
    { text: title, color: theme.white, bold: true, fontSize: 11, margin: [12, -16, 0, 5] },
  ],
});

const paragraph = (value: string): Content => ({
  text: value,
  fontSize: 10,
  color: theme.text,
  lineHeight: 1.25,
  margin: [0, 0, 0, 6],
});

const textBlock = (title: string, body: string | null, primary: string): Content[] =>
  body && body.trim() ? [sectionTitle(title, primary), paragraph(body.trim())] : [];

const itemsTable = (dataset: QuotationPdfDataset, primary: string): Content => {
  const header = ["#", "Código", "Producto", "Und.", "Cant.", "Precio", "Desc.", "IVA", "Total"].map(
    (label, index): TableCell => ({
      text: label.toUpperCase(),
      bold: true,
      fontSize: 8,
      color: theme.white,
      fillColor: primary,
      alignment: index >= 4 ? "right" : index === 3 ? "center" : "left",
    })
  );
  const rows = dataset.items.map((item, index): TableCell[] => {
    const fillColor = index % 2 === 0 ? theme.white : theme.soft;
    const cell = (value: string, alignment: "left" | "right" | "center" = "left"): TableCell => ({
      text: value,
      fontSize: 8,
      color: theme.text,
      fillColor,
      alignment,
    });
    return [
      cell(String(item.lineNumber)),
      cell(text(item.productCode)),
      {
        fillColor,
        stack: [
          { text: item.productName, fontSize: 8, color: theme.text },
          ...(item.promotionName
            ? [{ text: `Promoción: ${item.promotionName}`, fontSize: 7, italics: true, color: theme.muted }]
            : []),
        ],
      },
      cell(text(item.unitCode), "center"),
      cell(quantityFormat.format(item.quantity), "right"),
      cell(formatMoney(item.finalUnitPrice), "right"),
      cell(item.discountPercent > 0 ? `${percentFormat.format(item.discountPercent)}%` : "-", "right"),
      cell(`${percentFormat.format(item.taxRate)}%`, "right"),
      cell(formatMoney(item.lineTotal), "right"),
    ];
  });
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      keepWithHeaderRows: 1,
      widths: [16, 52, "*", 28, 36, 62, 32, 30, 66],
      body: [header, ...rows],
    },
    layout: {
      hLineColor: () => theme.line,
      vLineColor: () => theme.line,
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 12],
  };
};

const financialSummary = (dataset: QuotationPdfDataset): Content => {
  const { quotation } = dataset;
  const rows: Array<[string, number]> = [
    ["Subtotal", quotation.subtotal],
    ...dataset.taxes.map(
      (tax): [string, number] => [`${tax.taxName} (${percentFormat.format(tax.taxRate)}%)`, tax.taxAmount]
    ),
  ];
  if (dataset.taxes.length === 0 && quotation.taxTotal > 0) {
    rows.push(["Impuestos", quotation.taxTotal]);
  }
  return {
    unbreakable: true,
    columns: [
      {
        width: "*",
        stack:
          quotation.discountTotal > 0
            ? [
                {
                  text: `Ahorro por promociones incluido en los precios: ${formatMoney(quotation.discountTotal)}`,
                  fontSize: 9,
                  italics: true,
                  color: theme.muted,
                  margin: [0, 6, 12, 0],
                },
              ]
            : [{ text: "" }],
      },
      {
        width: 250,
        stack: [
          {
            table: {
              widths: ["*", 100],
              body: rows.map(([label, value]): TableCell[] => [
                { text: label, fontSize: 10, color: theme.text, fillColor: theme.soft },
                { text: formatMoney(value), fontSize: 10, color: theme.text, fillColor: theme.soft, alignment: "right" },
              ]),
            },
            layout: {
              hLineColor: () => theme.line,
              vLineColor: () => theme.line,
              hLineWidth: () => 0.6,
              vLineWidth: () => 0.6,
              paddingTop: () => 6,
              paddingBottom: () => 6,
              paddingLeft: () => 10,
              paddingRight: () => 10,
            },
          },
          {
            margin: [0, 10, 0, 0],
            table: {
              widths: ["*", 120],
              body: [[
                { text: "TOTAL", bold: true, fontSize: 12, color: theme.white, fillColor: theme.secondary },
                {
                  text: formatMoney(quotation.total),
                  bold: true,
                  fontSize: 12,
                  color: theme.white,
                  fillColor: theme.secondary,
                  alignment: "right",
                },
              ]],
            },
            layout: {
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingTop: () => 7,
              paddingBottom: () => 7,
              paddingLeft: () => 10,
              paddingRight: () => 10,
            },
          },
        ],
      },
    ],
    margin: [0, 0, 0, 14],
  };
};

const amountInWords = (dataset: QuotationPdfDataset, primary: string): Content => ({
  unbreakable: true,
  margin: [0, 0, 0, 12],
  stack: [
    { text: "Total en letras", bold: true, fontSize: 10, color: primary },
    { text: amountToPesosInWords(dataset.quotation.total), fontSize: 10, color: theme.text, margin: [0, 3, 0, 0] },
  ],
});

const signature = (company: QuotationPdfDataset["company"]): Content => {
  const document = [company.representativeDocumentType, company.representativeDocumentNumber]
    .filter(Boolean)
    .join(" ");
  return {
    unbreakable: true,
    margin: [10, 36, 0, 0],
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.8, lineColor: theme.text }] },
      { text: text(company.representativeName, "Representante legal"), fontSize: 10, color: theme.text, margin: [0, 6, 0, 0] },
      ...(document ? [{ text: document, fontSize: 10, color: theme.text }] : []),
      { text: "Representante legal", fontSize: 10, color: theme.text },
      { text: text(company.legalName, company.name), fontSize: 9, color: theme.text, margin: [0, 6, 0, 0] },
      ...(company.nit ? [{ text: `NIT: ${nitLabel(company)}`, fontSize: 9, color: theme.text }] : []),
    ],
  };
};

const nitLabel = (company: QuotationPdfDataset["company"]) =>
  company.dv ? `${company.nit}-${company.dv}` : String(company.nit);

const institutionalFooter = (
  dataset: QuotationPdfDataset,
  primary: string,
  currentPage: number,
  pageCount: number
): Content => {
  const company = dataset.company;
  const contact = [company.phone, company.email, company.website].filter(Boolean).join("  |  ");
  const address = [company.address, company.city].filter(Boolean).join(", ");
  return {
    margin: [MARGIN_X, 8, MARGIN_X, 0],
    stack: [
      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: PAGE_WIDTH - MARGIN_X * 2, y2: 0, lineWidth: 0.8, lineColor: "#dce3ea" },
        ],
      },
      {
        margin: [0, 6, 0, 0],
        columns: [
          {
            width: "*",
            stack: [
              { text: text(company.legalName, company.name), bold: true, fontSize: 7.5, color: primary },
              { text: contact || " ", fontSize: 7.5, color: theme.muted },
            ],
          },
          {
            width: "*",
            stack: [
              { text: address || " ", fontSize: 7.5, color: theme.muted },
              { text: company.nit ? `NIT: ${nitLabel(company)}` : " ", fontSize: 7.5, color: theme.muted },
            ],
          },
          {
            width: 80,
            text: `Página ${currentPage} de ${pageCount}`,
            fontSize: 7.5,
            color: theme.muted,
            alignment: "right",
          },
        ],
      },
    ],
  };
};

export const buildQuotationPdfLayout = (dataset: QuotationPdfDataset): TDocumentDefinitions => {
  const primary = resolveColor(dataset.company.primaryColor, QUOTATION_PDF_DEFAULT_PRIMARY);
  const accent = resolveColor(dataset.company.accentColor, QUOTATION_PDF_DEFAULT_ACCENT);
  const intro =
    `Tenemos el gusto de atender su solicitud y presentar la siguiente cotización de productos, ` +
    `válida hasta el ${formatLongDate(dataset.quotation.validUntil)}. ` +
    `El total incluye los impuestos detallados en el cuadro económico.`;

  return {
    pageSize: "A4",
    pageMargins: [MARGIN_X, 60, MARGIN_X, 64],
    info: {
      title: `Cotización ${dataset.quotation.code}`,
      author: text(dataset.company.legalName, dataset.company.name),
      subject: `Cotización para ${dataset.customer.name}`,
    },
    background: (currentPage: number) =>
      currentPage === 1
        ? {
            canvas: [
              { type: "rect", x: 0, y: 0, w: PAGE_WIDTH, h: BAND_HEIGHT, color: primary },
              { type: "rect", x: 0, y: 132, w: PAGE_WIDTH, h: 26, color: accent },
            ],
          }
        : null,
    header: (currentPage: number) =>
      currentPage === 1
        ? null
        : {
            text: dataset.quotation.code,
            alignment: "right",
            bold: true,
            fontSize: 12,
            color: "#b8c2cc",
            margin: [MARGIN_X, 24, MARGIN_X, 0],
          },
    footer: (currentPage: number, pageCount: number) =>
      institutionalFooter(dataset, primary, currentPage, pageCount),
    content: [
      ...coverHeader(dataset, primary),
      coverCards(dataset, primary),
      sectionTitle("Descripción", primary),
      paragraph(intro),
      sectionTitle("Detalle económico", primary),
      itemsTable(dataset, primary),
      sectionTitle("Cuadro económico", primary),
      financialSummary(dataset),
      amountInWords(dataset, primary),
      ...textBlock("Condiciones comerciales", dataset.quotation.commercialTerms, primary),
      ...textBlock("Forma de pago y entrega", dataset.quotation.paymentDeliveryTerms, primary),
      ...textBlock("Garantía", dataset.quotation.warrantyTerms, primary),
      sectionTitle("Observaciones", primary),
      paragraph(text(dataset.quotation.notes, "Sin observaciones registradas.")),
      signature(dataset.company),
    ],
    defaultStyle: { font: "Roboto", fontSize: 10, color: theme.text },
  };
};
