import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import QRCode from "qrcode";

type MetadataRow = {
  label: string;
  value: string;
};

type TotalsRow = {
  label: string;
  value: string;
};

type ThermalLayoutOptions = {
  title: string;
  subtitle?: string | null;
  logo?: string | null;
  metadata?: MetadataRow[];
  sections?: Content[];
  totals?: TotalsRow[];
  footerText?: string;
  qrPayload?: string | null;
};

const pointsPerMillimeter = 72 / 25.4;

/**
 * Thermal paper is nominally 80 mm wide, but common 203 dpi printers expose
 * about 72 mm of dots. Keep a further 2 mm guard area inside that printable
 * width so browser/driver printing does not place content at the paper edge.
 */
export const THERMAL_80MM_LAYOUT = {
  profileId: "THERMAL_80MM",
  paperWidthPt: 80 * pointsPerMillimeter,
  printableWidthPt: 72 * pointsPerMillimeter,
  safeContentWidthPt: 68 * pointsPerMillimeter,
  safeHorizontalMarginPt: 6 * pointsPerMillimeter,
  safeVerticalMarginPt: 4 * pointsPerMillimeter,
  itemAmountColumnWidthPt: 60,
  totalsAmountColumnWidthPt: 64,
  metadataLabelColumnWidthPt: 48,
} as const;

export const THERMAL_QR_MAX_WIDTH_PT = 40 * pointsPerMillimeter;

const thermalSoftBreakInterval = 16;

/**
 * PDF line breaking does not always split a UUID, SKU or other long token.
 * Add invisible break points without removing or changing its visible value.
 */
export const addThermalSoftBreaks = (value: string) =>
  value
    .split(/(\s+)/)
    .map((token) =>
      /^\s+$/.test(token)
        ? token
        : token.replace(
            new RegExp(`(.{${thermalSoftBreakInterval}})(?=.)`, "g"),
            "$1\u200B"
          )
    )
    .join("");

/** pdfmake fallback fonts do not encode zero-width spaces. */
export const addPdfSoftBreaks = (value: string) =>
  addThermalSoftBreaks(value).replace(/\u200B/g, "\n");

export const buildThermalDivider = (): Content => ({
  margin: [0, 6, 0, 6],
  canvas: [
    {
      type: "line",
      x1: 0,
      y1: 0,
      x2: THERMAL_80MM_LAYOUT.safeContentWidthPt,
      y2: 0,
      lineWidth: 0.5,
    },
  ],
});

export const buildThermalHeader = (
  title: string,
  subtitle?: string | null
): Content => ({
  alignment: "center",
  stack: [
    { text: title, style: "title" },
    ...(subtitle ? [{ text: subtitle, style: "subtitle" as const }] : []),
  ],
});

export const buildThermalSectionTitle = (title: string): Content => ({
  text: title,
  style: "sectionLabel",
});

export const buildThermalMetadata = (rows: MetadataRow[] = []): Content => ({
  table: {
    widths: [THERMAL_80MM_LAYOUT.metadataLabelColumnWidthPt, "*"],
    body: rows.map(
      (row) =>
        [
          { text: `${row.label}:`, style: "metadataLabel" },
          { text: addPdfSoftBreaks(row.value), style: "metadataValue" },
        ] as TableCell[]
    ),
  },
  layout: "noBorders",
});

export const buildThermalTotals = (rows: TotalsRow[] = []): Content => ({
  table: {
    widths: ["*", THERMAL_80MM_LAYOUT.totalsAmountColumnWidthPt],
    body: rows.map(
      (row) =>
        [
          { text: row.label, style: "totalsLabel" },
          { text: row.value, style: "totalsValue", alignment: "right" },
        ] as TableCell[]
    ),
  },
  layout: "noBorders",
});

export const buildThermalFooter = (text: string): Content => ({
  margin: [0, 10, 0, 0],
  text,
  alignment: "center",
  style: "footer",
});

export const buildThermalQr = (payload: string): Content => {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const moduleCount = qr.modules.size;
  const quiet = 4;
  // Keep the receipt QR compact. With the current 80 mm PDF width this is
  // roughly 35-40 mm, including the quiet zone, instead of filling the page.
  const cell = Math.max(
    1,
    Math.floor(THERMAL_QR_MAX_WIDTH_PT / (moduleCount + quiet * 2))
  );
  const size = (moduleCount + quiet * 2) * cell;
  const rects: Array<{ type: "rect"; x: number; y: number; w: number; h: number; color: string }> = [];
  for (let y = 0; y < moduleCount; y += 1) {
    for (let x = 0; x < moduleCount; x += 1) {
      if (qr.modules.get(x, y)) {
        rects.push({
          type: "rect",
          x: (x + quiet) * cell,
          y: (y + quiet) * cell,
          w: cell,
          h: cell,
          color: "#000000",
        });
      }
    }
  }
  return {
    canvas: [
      { type: "rect", x: 0, y: 0, w: size, h: size, color: "#ffffff" },
      ...rects,
    ],
    alignment: "center",
    margin: [0, 8, 0, 4],
  };
};

export const thermalStyles: StyleDictionary = {
  title: {
    fontSize: 12,
    bold: true,
  },
  subtitle: {
    fontSize: 10,
    margin: [0, 2, 0, 0],
  },
  sectionLabel: {
    fontSize: 9,
    bold: true,
    margin: [0, 2, 0, 0],
  },
  tableHeader: {
    bold: true,
    fillColor: "#e2e8f0",
    fontSize: 8.5,
  },
  metadataLabel: {
    fontSize: 8.5,
    bold: true,
  },
  metadataValue: {
    fontSize: 8.5,
  },
  totalsLabel: {
    fontSize: 8.5,
    bold: true,
  },
  totalsValue: {
    fontSize: 8.5,
    bold: true,
  },
  footer: {
    fontSize: 8,
    color: "#64748b",
  },
};

export const buildThermalDocument = (
  options: ThermalLayoutOptions
): TDocumentDefinitions => ({
  pageSize: {
    width: THERMAL_80MM_LAYOUT.paperWidthPt,
    height: "auto",
  },
  pageMargins: [
    THERMAL_80MM_LAYOUT.safeHorizontalMarginPt,
    THERMAL_80MM_LAYOUT.safeVerticalMarginPt,
    THERMAL_80MM_LAYOUT.safeHorizontalMarginPt,
    THERMAL_80MM_LAYOUT.safeVerticalMarginPt,
  ],
  content: [
    ...(options.logo && /^data:image\/(?:png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/i.test(options.logo)
      ? [{ image: options.logo, width: 96, alignment: "center" as const, margin: [0, 0, 0, 4] as [number, number, number, number] }]
      : []),
    buildThermalHeader(options.title, options.subtitle),
    ...(options.metadata && options.metadata.length > 0
      ? [buildThermalDivider(), buildThermalMetadata(options.metadata)]
      : []),
    ...((options.sections ?? []).flatMap((section) => [
      buildThermalDivider(),
      section,
    ])),
    ...(options.totals && options.totals.length > 0
      ? [buildThermalDivider(), buildThermalTotals(options.totals)]
      : []),
    ...(options.qrPayload ? [buildThermalQr(options.qrPayload)] : []),
    buildThermalFooter(
      options.footerText ?? "Documento generado por Manus Tienda."
    ),
  ],
  styles: thermalStyles,
  defaultStyle: {
    font: "Roboto",
    fontSize: 8.5,
  },
});
