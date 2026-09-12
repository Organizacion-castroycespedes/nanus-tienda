import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

export type DemoReportItem = {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type DemoReportDataset = {
  reportTitle: string;
  tenantName: string;
  branchName: string;
  generatedAt: string;
  items: DemoReportItem[];
  total: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const buildHeader = (dataset: DemoReportDataset): Content => ({
  margin: [0, 0, 0, 16],
  stack: [
    { text: dataset.reportTitle, style: "title" },
    { text: dataset.tenantName, style: "subtitle" },
    {
      text: `Sucursal: ${dataset.branchName}  |  Generado: ${dataset.generatedAt}`,
      style: "meta",
    },
  ],
});

const buildItemsTable = (dataset: DemoReportDataset): Content => ({
  table: {
    widths: ["auto", "*", "auto", "auto", "auto"],
    body: [
      [
        { text: "Codigo", style: "tableHeader" },
        { text: "Descripcion", style: "tableHeader" },
        { text: "Cantidad", style: "tableHeader" },
        { text: "Precio", style: "tableHeader" },
        { text: "Subtotal", style: "tableHeader" },
      ] as TableCell[],
      ...dataset.items.map(
        (item) =>
          [
            item.code,
            item.description,
            { text: String(item.quantity), alignment: "right" },
            { text: formatCurrency(item.unitPrice), alignment: "right" },
            { text: formatCurrency(item.subtotal), alignment: "right" },
          ] as TableCell[]
      ),
    ],
  },
  layout: "lightHorizontalLines",
});

const buildTotals = (dataset: DemoReportDataset): Content => ({
  margin: [0, 16, 0, 0],
  alignment: "right",
  table: {
    widths: [120, 120],
    body: [
      [
        { text: "Total", style: "totalsLabel" },
        { text: formatCurrency(dataset.total), style: "totalsValue", alignment: "right" },
      ] as TableCell[],
    ],
  },
  layout: "noBorders",
});

const buildFooter = (): Content => ({
  margin: [0, 20, 0, 0],
  text: "Documento de reportería generado por Manus Tienda.",
  style: "footer",
});

export const buildBaseReportLayout = (
  dataset: DemoReportDataset
): TDocumentDefinitions => ({
  pageSize: "A4",
  pageMargins: [40, 40, 40, 40],
  content: [
    buildHeader(dataset),
    buildItemsTable(dataset),
    buildTotals(dataset),
    buildFooter(),
  ],
  styles: {
    title: {
      fontSize: 18,
      bold: true,
    },
    subtitle: {
      fontSize: 11,
      margin: [0, 4, 0, 0],
    },
    meta: {
      fontSize: 9,
      color: "#64748b",
      margin: [0, 4, 0, 0],
    },
    tableHeader: {
      bold: true,
      fillColor: "#e2e8f0",
    },
    totalsLabel: {
      bold: true,
      fontSize: 11,
    },
    totalsValue: {
      bold: true,
      fontSize: 11,
    },
    footer: {
      fontSize: 9,
      color: "#475569",
      italics: true,
    },
  },
  defaultStyle: {
    font: "Roboto",
    fontSize: 10,
  },
});
