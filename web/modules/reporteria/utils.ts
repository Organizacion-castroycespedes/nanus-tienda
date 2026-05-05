import { ApiError } from "../../lib/request";

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value ?? 0);

export const formatDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
  }).format(date);
};

export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "-";
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

export const getTodayRange = () => {
  const today = new Date();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  const isoDate = `${today.getFullYear()}-${month}-${day}`;

  return {
    from: isoDate,
    to: isoDate,
  };
};

export const normalizeFilters = <T extends Record<string, string | undefined>>(filters: T) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value))
  ) as T;

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getApiErrorMessage = (
  error: unknown,
  fallbackMessage: string
) => {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};

type ExcelCell = string | number | null | undefined;

type ExcelSheet = {
  name: string;
  rows: ExcelCell[][];
};

type ReportExportWorkbook = {
  fileName: string;
  summaryTitle: string;
  detailTitle: string;
  filters: Array<{ label: string; value: ExcelCell }>;
  summary: Array<{ label: string; value: ExcelCell }>;
  columns: string[];
  rows: ExcelCell[][];
};

const escapeXml = (value: ExcelCell) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const getExcelDataType = (value: ExcelCell) =>
  typeof value === "number" && Number.isFinite(value) ? "Number" : "String";

const buildSheetXml = (sheet: ExcelSheet) => {
  const maxColumns = sheet.rows.reduce(
    (current, row) => Math.max(current, row.length),
    0
  );

  const rowsXml = sheet.rows
    .map(
      (row) =>
        `<Row>${row
          .map(
            (cell, index) => `<Cell ss:StyleID="${
              sheet.name === "Detalle" && sheet.rows[0] && row === sheet.rows[0]
                ? "header"
                : index === 0
                  ? "label"
                  : "value"
            }"><Data ss:Type="${getExcelDataType(cell)}">${escapeXml(
              cell
            )}</Data></Cell>`
          )
          .join("")}</Row>`
    )
    .join("");

  return `<Worksheet ss:Name="${escapeXml(
    sheet.name
  )}"><Table ss:ExpandedColumnCount="${maxColumns}" ss:ExpandedRowCount="${
    sheet.rows.length
  }" x:FullColumns="1" x:FullRows="1">${rowsXml}</Table></Worksheet>`;
};

const buildWorkbookXml = (sheets: ExcelSheet[]) => `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="label">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#334155"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="value">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${sheets.map(buildSheetXml).join("")}
</Workbook>`;

const saveTextAsFile = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, fileName);
};

export const downloadReportWorkbook = ({
  fileName,
  summaryTitle,
  detailTitle,
  filters,
  summary,
  columns,
  rows,
}: ReportExportWorkbook) => {
  const exportedAt = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const summaryRows: ExcelCell[][] = [
    [summaryTitle],
    ["Exportado", exportedAt],
    [],
    ["Filtros"],
    ...filters.map((item) => [item.label, item.value ?? "-"]),
    [],
    ["Resumen"],
    ...summary.map((item) => [item.label, item.value ?? "-"]),
  ];

  const detailRows: ExcelCell[][] = [
    [detailTitle],
    ["Exportado", exportedAt],
    [],
    columns,
    ...rows,
  ];

  const workbook = buildWorkbookXml([
    { name: "Resumen", rows: summaryRows },
    { name: "Detalle", rows: detailRows },
  ]);

  saveTextAsFile(
    workbook,
    fileName.endsWith(".xls") ? fileName : `${fileName}.xls`,
    "application/vnd.ms-excel;charset=utf-8;"
  );
};
