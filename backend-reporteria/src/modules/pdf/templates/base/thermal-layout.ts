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

export const buildThermalDivider = (): Content => ({
  margin: [0, 6, 0, 6],
  canvas: [{ type: "line", x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5 }],
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
  fontSize: 8.5,
  stack: rows.map((row) => ({
    text: `${row.label}: ${row.value}`,
  })),
});

export const buildThermalTotals = (rows: TotalsRow[] = []): Content => ({
  table: {
    widths: ["*", "auto"],
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
    width: 226,
    height: "auto",
  },
  pageMargins: [12, 12, 12, 16],
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
