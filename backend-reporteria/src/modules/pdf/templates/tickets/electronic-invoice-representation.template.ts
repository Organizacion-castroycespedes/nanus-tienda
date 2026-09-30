import type { Content, TableCell } from "pdfmake/interfaces";
import type {
  ElectronicInvoiceParty,
  ElectronicInvoiceRepresentation,
  FiscalGraphicParty,
  FiscalGraphicRepresentation,
} from "../../../reports/types/electronic-invoice-representation.types";
import {
  buildThermalCustomDocument,
  buildThermalDivider,
  buildThermalLogo,
  buildThermalQr,
  THERMAL_80MM_LAYOUT,
} from "../base/thermal-layout";

const MUTED = "#475569";
const DOCUMENT_KEY_CHUNK = 48;
const LONG_TOKEN_LIMIT = 34;

const IDENTIFICATION_TYPES: Record<string, string> = {
  "11": "RC",
  "12": "TI",
  "13": "CC",
  "21": "TE",
  "22": "CE",
  "31": "NIT",
  "41": "PA",
  "42": "DIE",
  "47": "PEP",
  "48": "PPT",
  "50": "NIT otro país",
  "91": "NUIP",
};

const PAYMENT_FORMS: Record<string, string> = {
  "1": "Contado",
  "2": "Crédito",
};

const PAYMENT_MEANS: Record<string, string> = {
  "1": "Instrumento no definido",
  "10": "Efectivo",
  "20": "Cheque",
  "30": "Transferencia crédito",
  "31": "Transferencia débito",
  "42": "Consignación bancaria",
  "47": "Transferencia débito bancaria",
  "48": "Tarjeta crédito",
  "49": "Tarjeta débito",
  "71": "Bonos",
  "72": "Vales",
  ZZZ: "Otro",
};

const TAX_LABELS: Record<string, string> = {
  IVA: "IVA",
  INC: "INC",
  IBUA: "IBUA",
  ICL: "ICL",
  ADV: "ADV",
  ICA: "ICA",
  OTHER: "Otro impuesto",
};

const FISCAL_RESPONSIBILITIES: Record<string, string> = {
  "O-13": "Gran contribuyente",
  "O-15": "Autorretenedor",
  "O-23": "Agente de retención IVA",
  "O-47": "Régimen simple de tributación",
  "R-99-PN": "No responsable",
};

const TAX_SCHEMES: Record<string, string> = {
  "01": "Responsable de IVA",
  "04": "Responsable de INC",
  ZA: "Responsable de IVA e INC",
  ZZ: "No responsable de IVA",
};

const DOCUMENT_TITLES: Record<string, string> = {
  INVOICE: "FACTURA ELECTRÓNICA DE VENTA",
  CREDIT_NOTE: "NOTA CRÉDITO ELECTRÓNICA",
  DEBIT_NOTE: "NOTA DÉBITO ELECTRÓNICA",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 }).format(value);

const formatRate = (value: number) =>
  `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value)}%`;

const formatCalendarDate = (value: string | null | undefined) => {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
};

const formatInstant = (value: string | null) => {
  if (!value) return { date: null, time: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: null, time: null };
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("day")}/${get("month")}/${get("year")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
};

/** pdfmake no parte tokens sin espacios; solo se cortan los que exceden el ancho útil. */
const wrapLongTokens = (value: string, limit = LONG_TOKEN_LIMIT) =>
  value
    .split(/(\s+)/)
    .map((token) =>
      token.length > limit ? token.match(new RegExp(`.{1,${limit}}`, "g"))?.join("\n") ?? token : token
    )
    .join("");

const chunk = (value: string, size: number) => value.match(new RegExp(`.{1,${size}}`, "g")) ?? [value];

const identificationLabel = (typeCode: string | null | undefined) => {
  if (!typeCode) return null;
  return IDENTIFICATION_TYPES[typeCode] ?? typeCode;
};

const formatIdentification = (
  typeCode: string | null | undefined,
  number: string | null | undefined,
  verificationDigit?: string | null
) => {
  if (!number) return null;
  const label = identificationLabel(typeCode);
  const value = verificationDigit ? `${number}-${verificationDigit}` : number;
  return label ? `${label} ${value}` : value;
};

const describeResponsibilities = (party: FiscalGraphicParty) => {
  const codes = party.fiscalResponsibilityCodes
    .map((code) => (FISCAL_RESPONSIBILITIES[code] ? `${code} ${FISCAL_RESPONSIBILITIES[code]}` : code))
    .join(" · ");
  const scheme = party.taxSchemeId ? TAX_SCHEMES[party.taxSchemeId] ?? party.taxSchemeName : party.taxSchemeName;
  return [scheme, codes ? `Resp. fiscal: ${codes}` : null].filter(Boolean) as string[];
};

const joinLocation = (...parts: Array<string | null | undefined>) =>
  parts.filter((part): part is string => Boolean(part && part.trim())).join(", ");

const small = (text: string, extra: Record<string, unknown> = {}): Content => ({
  text: wrapLongTokens(text),
  fontSize: 7,
  color: MUTED,
  ...extra,
});

const sectionTitle = (text: string): Content => ({
  text,
  bold: true,
  fontSize: 8,
  margin: [0, 0, 0, 2],
});

const keyValueTable = (rows: Array<[string, string | null | undefined]>): Content => ({
  table: {
    widths: [THERMAL_80MM_LAYOUT.metadataLabelColumnWidthPt + 10, "*"],
    body: rows
      .filter((row): row is [string, string] => Boolean(row[1]))
      .map(([label, value]) => [
        { text: label, bold: true, fontSize: 7.5, margin: [0, 1, 0, 1] },
        { text: wrapLongTokens(value, 28), fontSize: 7.5, margin: [0, 1, 0, 1] },
      ] as TableCell[]),
  },
  layout: "noBorders",
});

const toFiscalParty = (party: ElectronicInvoiceParty): FiscalGraphicParty => ({
  legalName: party.name,
  tradeName: null,
  personType: "NATURAL",
  identificationTypeCode: party.identificationType === "NIT" ? "31" : party.identificationType,
  identificationNumber: party.identificationNumber ?? "",
  verificationDigit: party.verificationDigit ?? null,
  fiscalResponsibilityCodes: [],
  taxSchemeId: null,
  taxSchemeName: null,
  address: party.address,
  city: party.municipality,
  department: party.department,
  country: party.country,
  phone: party.phone ?? null,
  email: party.email ?? null,
});

const buildIssuerBlock = (issuer: FiscalGraphicParty): Content => ({
  alignment: "center",
  stack: [
    { text: wrapLongTokens(issuer.legalName), bold: true, fontSize: 10 },
    ...(issuer.tradeName && issuer.tradeName !== issuer.legalName
      ? [{ text: wrapLongTokens(issuer.tradeName), fontSize: 8.5 }]
      : []),
    ...(issuer.identificationNumber
      ? [{
          text: formatIdentification("31", issuer.identificationNumber, issuer.verificationDigit) ?? "",
          bold: true,
          fontSize: 8.5,
          margin: [0, 1, 0, 0] as [number, number, number, number],
        }]
      : []),
    ...describeResponsibilities(issuer).map((line) => small(line, { alignment: "center" })),
    ...(joinLocation(issuer.address, issuer.city, issuer.department)
      ? [small(joinLocation(issuer.address, issuer.city, issuer.department), { alignment: "center" })]
      : []),
    ...([issuer.phone ? `Tel. ${issuer.phone}` : null, issuer.email].filter(Boolean).length
      ? [small([issuer.phone ? `Tel. ${issuer.phone}` : null, issuer.email].filter(Boolean).join(" · "), { alignment: "center" })]
      : []),
  ],
});

const buildTitleBlock = (
  fiscal: FiscalGraphicRepresentation | null,
  number: string
): Content => {
  const resolution = fiscal?.resolution;
  return {
    alignment: "center",
    stack: [
      { text: DOCUMENT_TITLES[fiscal?.documentType ?? "INVOICE"] ?? DOCUMENT_TITLES.INVOICE, bold: true, fontSize: 10.5 },
      { text: `No. ${number}`, bold: true, fontSize: 10, margin: [0, 1, 0, 2] },
      ...(resolution
        ? [small(
            `Autorización de numeración DIAN No. ${resolution.number} del ${formatCalendarDate(resolution.validFrom)}. ` +
              `Prefijo ${resolution.prefix ?? "sin prefijo"}, del ${resolution.rangeStart} al ${resolution.rangeEnd}. ` +
              `Vigencia hasta ${formatCalendarDate(resolution.validTo)}.`,
            { alignment: "center" }
          )]
        : []),
      ...(fiscal && fiscal.environment !== "PRODUCTION"
        ? [small("Documento emitido en ambiente de habilitación DIAN.", { alignment: "center", bold: true })]
        : []),
    ],
  };
};

const buildIssueBlock = (
  representation: ElectronicInvoiceRepresentation,
  fiscal: FiscalGraphicRepresentation | null
): Content => {
  const fallback = formatInstant(representation.invoice.issuedAt);
  const payments = fiscal?.payments ?? [];
  const forms = [...new Set(payments.map((payment) => PAYMENT_FORMS[payment.formCode] ?? payment.formCode))];
  const means = [...new Set(payments.map((payment) => PAYMENT_MEANS[payment.meansCode] ?? payment.meansCode))];
  const dueDate = fiscal?.dueDate ?? payments.find((payment) => payment.dueDate)?.dueDate ?? null;
  const reference = fiscal?.referencedDocument;
  return keyValueTable([
    ["Fecha emisión", formatCalendarDate(fiscal?.issueDate) ?? fallback.date],
    ["Hora emisión", fiscal?.issueTime ? fiscal.issueTime.slice(0, 8) : fallback.time],
    ["Vencimiento", formatCalendarDate(dueDate)],
    ["Forma de pago", forms.join(", ") || null],
    ["Medio de pago", means.join(", ") || representation.sale.paymentMethod],
    ["Moneda", fiscal?.currency ?? "COP"],
    ["Factura ref.", reference?.fullNumber ?? null],
    ["Fecha ref.", formatCalendarDate(reference?.issueDate)],
  ]);
};

const buildCustomerBlock = (customer: FiscalGraphicParty): Content => {
  const scheme = customer.taxSchemeId
    ? TAX_SCHEMES[customer.taxSchemeId] ?? customer.taxSchemeName
    : customer.taxSchemeName;
  const responsibilities = customer.fiscalResponsibilityCodes
    .map((code) => (FISCAL_RESPONSIBILITIES[code] ? `${code} ${FISCAL_RESPONSIBILITIES[code]}` : code))
    .join(", ");
  return {
    stack: [
      sectionTitle("ADQUIRENTE"),
      {
        text: wrapLongTokens(customer.legalName || "Consumidor final"),
        bold: true,
        fontSize: 8.5,
        margin: [0, 0, 0, 3],
      },
      keyValueTable([
        [
          identificationLabel(customer.identificationTypeCode) ?? "Identificación",
          customer.identificationNumber
            ? `${customer.identificationNumber}${customer.verificationDigit ? `-${customer.verificationDigit}` : ""}`
            : null,
        ],
        ["Régimen", scheme],
        ["Resp. fiscal", responsibilities || null],
        ["Dirección", customer.address],
        ["Ciudad", joinLocation(customer.city, customer.department, customer.country) || null],
        ["Teléfono", customer.phone],
        ["Correo", customer.email],
      ]),
    ],
  };
};

type DetailLine = {
  lineNumber: number;
  code: string | null;
  description: string;
  quantity: number;
  unitCode: string | null;
  unitPrice: number;
  discount: number;
  taxes: Array<{ type: string; rate: number }>;
  amount: number;
};

const buildDetailLines = (
  representation: ElectronicInvoiceRepresentation,
  fiscal: FiscalGraphicRepresentation | null
): DetailLine[] =>
  fiscal?.lines.length
    ? fiscal.lines.map((line) => ({
        lineNumber: line.lineNumber,
        code: line.code,
        description: line.description,
        quantity: line.quantity,
        unitCode: line.unitCode,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxes: line.taxes.map((tax) => ({ type: tax.type, rate: tax.rate })),
        amount: line.lineExtensionAmount,
      }))
    : representation.sale.items.map((item, index) => ({
        lineNumber: index + 1,
        code: null,
        description: item.productName,
        quantity: item.quantity,
        unitCode: null,
        unitPrice: item.unitValue,
        discount: item.discount,
        taxes: [],
        amount: item.total,
      }));

const buildDetailBlock = (lines: DetailLine[]): Content => ({
  stack: [
    sectionTitle("DETALLE"),
    {
      table: {
        headerRows: 1,
        widths: ["*", THERMAL_80MM_LAYOUT.itemAmountColumnWidthPt],
        body: [
          [
            { text: "Descripción", style: "tableHeader", fontSize: 7.5 },
            { text: "Valor", style: "tableHeader", fontSize: 7.5, alignment: "right" },
          ] as TableCell[],
          ...lines.map((line) => {
            const detail = [
              line.code ? `Cód. ${line.code}` : null,
              `${formatQuantity(line.quantity)}${line.unitCode ? ` ${line.unitCode}` : ""} x ${formatCurrency(line.unitPrice)}`,
              line.discount > 0 ? `Desc. ${formatCurrency(line.discount)}` : null,
              ...line.taxes.map((tax) => `${TAX_LABELS[tax.type] ?? tax.type} ${formatRate(tax.rate)}`),
            ].filter(Boolean).join(" · ");
            return [
              {
                stack: [
                  { text: wrapLongTokens(`${line.lineNumber}. ${line.description}`), bold: true, fontSize: 7.5 },
                  small(detail),
                ],
              },
              { text: formatCurrency(line.amount), alignment: "right", fontSize: 7.5 },
            ] as TableCell[];
          }),
        ],
      },
      layout: "lightHorizontalLines",
    },
    small(`Total ítems: ${lines.length}`, { margin: [0, 2, 0, 0] }),
  ],
});

const buildTotalsBlock = (
  representation: ElectronicInvoiceRepresentation,
  fiscal: FiscalGraphicRepresentation | null
): Content => {
  const subtotal = fiscal?.totals.lineExtension ?? representation.sale.subtotal;
  const discount = fiscal?.totals.discount ?? representation.sale.discounts;
  const payable = fiscal?.totals.payable ?? representation.sale.total;
  const taxRows: Array<[string, number]> = fiscal
    ? fiscal.taxTotals.map((tax) => [
        `${TAX_LABELS[tax.type] ?? tax.type} ${formatRate(tax.rate)} (base ${formatCurrency(tax.taxableBase)})`,
        tax.amount,
      ])
    : representation.sale.taxBreakdown?.length
      ? representation.sale.taxBreakdown.map((tax) => [
          `${tax.label} (base ${formatCurrency(tax.taxBase)})`,
          tax.taxAmount,
        ])
      : representation.sale.taxes > 0
        ? [["Impuestos", representation.sale.taxes]]
        : [];
  const rows: Array<[string, string, boolean]> = [
    ["Subtotal", formatCurrency(subtotal), false],
    ...(discount > 0 ? [["Descuentos", `- ${formatCurrency(discount)}`, false] as [string, string, boolean]] : []),
    ...taxRows.map(([label, amount]) => [label, formatCurrency(amount), false] as [string, string, boolean]),
  ];
  return {
    stack: [
      {
        table: {
          widths: ["*", THERMAL_80MM_LAYOUT.totalsAmountColumnWidthPt],
          body: rows.map(([label, value]) => [
            { text: label, fontSize: 7.5 },
            { text: value, fontSize: 7.5, alignment: "right" },
          ] as TableCell[]),
        },
        layout: "noBorders",
      },
      {
        margin: [0, 3, 0, 0],
        table: {
          widths: ["*", THERMAL_80MM_LAYOUT.totalsAmountColumnWidthPt + 16],
          body: [[
            { text: "TOTAL A PAGAR", bold: true, fontSize: 9.5 },
            { text: formatCurrency(payable), bold: true, fontSize: 9.5, alignment: "right" },
          ] as TableCell[]],
        },
        layout: "noBorders",
      },
    ],
  };
};

const buildPaymentsBlock = (
  representation: ElectronicInvoiceRepresentation,
  fiscal: FiscalGraphicRepresentation | null
): Content | null => {
  const rows = fiscal?.payments.filter((payment) => payment.amount !== null).length
    ? fiscal.payments.map((payment) => ({
        label: PAYMENT_MEANS[payment.meansCode] ?? payment.meansCode,
        amount: payment.amount ?? 0,
      }))
    : (representation.sale.paymentBreakdown ?? []).map((payment) => ({
        label: payment.method,
        amount: payment.amount,
      }));
  if (rows.length === 0) return null;
  return {
    stack: [
      sectionTitle("PAGOS"),
      {
        table: {
          widths: ["*", THERMAL_80MM_LAYOUT.totalsAmountColumnWidthPt],
          body: rows.map((row) => [
            { text: wrapLongTokens(row.label), fontSize: 7.5 },
            { text: formatCurrency(row.amount), fontSize: 7.5, alignment: "right" },
          ] as TableCell[]),
        },
        layout: "noBorders",
      },
    ],
  };
};

const buildDocumentKeyBlock = (keyType: string, value: string): Content => ({
  alignment: "center",
  stack: [
    { text: keyType, bold: true, fontSize: 7.5 },
    { text: chunk(value, DOCUMENT_KEY_CHUNK).join("\n"), fontSize: 6.5, characterSpacing: 0.1 },
  ],
});

const buildFooterBlock = (
  fiscal: FiscalGraphicRepresentation | null,
  issuer: FiscalGraphicParty
): Content => {
  const provider = fiscal?.softwareProvider;
  const ownSoftware = provider && provider.identificationNumber === issuer.identificationNumber;
  const title = fiscal?.documentType === "CREDIT_NOTE"
    ? "Representación gráfica de la nota crédito electrónica."
    : fiscal?.documentType === "DEBIT_NOTE"
      ? "Representación gráfica de la nota débito electrónica."
      : "Representación gráfica de la factura electrónica de venta.";
  return {
    alignment: "center",
    margin: [0, 4, 0, 0],
    stack: [
      { text: title, fontSize: 7, bold: true },
      small("Consulte su validez en catalogo-vpfe.dian.gov.co", { alignment: "center" }),
      ...(provider
        ? [small(
            ownSoftware
              ? `Software propio del facturador: ${provider.softwareName}`
              : `Software ${provider.softwareName} · Proveedor tecnológico: ${provider.name} NIT ${provider.identificationNumber}${provider.verificationDigit ? `-${provider.verificationDigit}` : ""}`,
            { alignment: "center" }
          )]
        : []),
      ...(fiscal?.notes ? [small(fiscal.notes, { alignment: "center", margin: [0, 2, 0, 0] })] : []),
    ],
  };
};

export const buildElectronicInvoiceRepresentationTemplate = (
  representation: ElectronicInvoiceRepresentation
) => {
  const fiscal = representation.fiscal ?? null;
  const issuer = fiscal?.issuer ?? toFiscalParty(representation.issuer);
  const customer = fiscal?.customer ?? toFiscalParty(representation.customer);
  const number = fiscal?.fullNumber || representation.invoice.number;
  const documentKey = fiscal?.documentKey.value ?? representation.invoice.cufe;
  const payments = buildPaymentsBlock(representation, fiscal);

  const content: Content[] = [
    ...buildThermalLogo(representation.logo),
    buildIssuerBlock(issuer),
    buildThermalDivider(),
    buildTitleBlock(fiscal, number),
    buildThermalDivider(),
    buildIssueBlock(representation, fiscal),
    buildThermalDivider(),
    buildCustomerBlock(customer),
    buildThermalDivider(),
    buildDetailBlock(buildDetailLines(representation, fiscal)),
    buildThermalDivider(),
    buildTotalsBlock(representation, fiscal),
    ...(payments ? [buildThermalDivider(), payments] : []),
    buildThermalDivider(),
    ...(documentKey ? [buildDocumentKeyBlock(fiscal?.documentKey.type ?? "CUFE", documentKey)] : []),
    ...(representation.invoice.qrPayload ? [buildThermalQr(representation.invoice.qrPayload)] : []),
    buildFooterBlock(fiscal, issuer),
  ];

  return buildThermalCustomDocument(content);
};
