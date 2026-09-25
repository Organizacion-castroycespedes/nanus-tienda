import ExcelJS from "exceljs";
import {
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_MAX_ROWS,
  PRODUCT_IMPORT_REQUIRED_HEADERS,
  PRODUCT_IMPORT_SHEET_NAME,
  type ProductImportColumnKey,
} from "./product-import.columns";

export type ProductImportRawRow = {
  rowNumber: number;
  values: Partial<Record<ProductImportColumnKey, string>>;
};

export type ProductImportParseResult = {
  rows: ProductImportRawRow[];
  ignoredHeaders: string[];
};

export class ProductImportParseError extends Error {}

const HEADER_ALIASES: Record<string, ProductImportColumnKey> = {
  codigo: "sku",
  nombre_producto: "nombre",
  producto: "nombre",
  precio: "precio_venta",
  precio_de_venta: "precio_venta",
  costo_producto: "costo",
  codigo_de_barras: "codigo_barras",
  barcode: "codigo_barras",
  sub_categoria: "subcategoria",
  tarifa_iva: "iva",
  lote: "lote_codigo",
  vencimiento: "fecha_vencimiento",
};

const KNOWN_KEYS = new Set<string>(
  PRODUCT_IMPORT_COLUMNS.map((column) => column.key)
);

export function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\*/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveHeaderKey(header: string): ProductImportColumnKey | null {
  const normalized = normalizeHeader(header);
  if (KNOWN_KEYS.has(normalized)) {
    return normalized as ProductImportColumnKey;
  }
  return HEADER_ALIASES[normalized] ?? null;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDate(value: Date) {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(
    value.getUTCDate()
  )}`;
}

export function cellValueToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return formatDate(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") {
    return value ? "SI" : "NO";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("result" in value) {
      return cellValueToText(value.result as ExcelJS.CellValue);
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("error" in value) {
      return "";
    }
  }
  return String(value).trim();
}

export async function parseProductImportWorkbook(
  buffer: Buffer,
  options: { maxRows?: number } = {}
): Promise<ProductImportParseResult> {
  const maxRows = options.maxRows ?? PRODUCT_IMPORT_MAX_ROWS;
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ProductImportParseError(
      "El archivo no es un .xlsx válido o está dañado."
    );
  }

  const worksheet =
    workbook.getWorksheet(PRODUCT_IMPORT_SHEET_NAME) ?? workbook.worksheets[0];
  if (!worksheet) {
    throw new ProductImportParseError("El archivo no tiene hojas.");
  }

  const headerRow = worksheet.getRow(1);
  const columnKeys = new Map<number, ProductImportColumnKey>();
  const ignoredHeaders: string[] = [];
  const seenKeys = new Set<ProductImportColumnKey>();

  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const header = cellValueToText(cell.value);
    if (!header) {
      return;
    }
    const key = resolveHeaderKey(header);
    if (!key) {
      ignoredHeaders.push(header);
      return;
    }
    if (seenKeys.has(key)) {
      throw new ProductImportParseError(
        `La columna "${key}" está repetida en el encabezado.`
      );
    }
    seenKeys.add(key);
    columnKeys.set(columnNumber, key);
  });

  const missing = PRODUCT_IMPORT_REQUIRED_HEADERS.filter(
    (key) => !seenKeys.has(key)
  );
  if (missing.length > 0) {
    throw new ProductImportParseError(
      `Faltan columnas obligatorias en la hoja "${worksheet.name}": ${missing.join(", ")}.`
    );
  }

  const rows: ProductImportRawRow[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: Partial<Record<ProductImportColumnKey, string>> = {};
    let hasValue = false;

    for (const [columnNumber, key] of columnKeys) {
      const text = cellValueToText(row.getCell(columnNumber).value);
      if (text) {
        values[key] = text;
        hasValue = true;
      }
    }

    if (!hasValue) {
      continue;
    }

    rows.push({ rowNumber, values });
    if (rows.length > maxRows) {
      throw new ProductImportParseError(
        `El archivo supera el máximo de ${maxRows} filas por carga.`
      );
    }
  }

  if (rows.length === 0) {
    throw new ProductImportParseError(
      `La hoja "${worksheet.name}" no tiene filas con datos.`
    );
  }

  return { rows, ignoredHeaders };
}
