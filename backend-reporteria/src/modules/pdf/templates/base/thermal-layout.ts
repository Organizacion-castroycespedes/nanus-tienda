import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

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
  metadata?: MetadataRow[];
  sections?: Content[];
  totals?: TotalsRow[];
  footerText?: string;
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
          { text: addThermalSoftBreaks(row.value), style: "metadataValue" },
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
    buildThermalFooter(
      options.footerText ?? "Documento generado por backend-reporteria."
    ),
  ],
  styles: thermalStyles,
  defaultStyle: {
    font: "Roboto",
    fontSize: 8.5,
  },
});
