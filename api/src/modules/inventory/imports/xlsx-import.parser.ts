import ExcelJS from "exceljs";

export type XlsxImportRawRow<K extends string> = {
  rowNumber: number;
  values: Partial<Record<K, string>>;
};

export type XlsxImportParseResult<K extends string> = {
  rows: XlsxImportRawRow<K>[];
  ignoredHeaders: string[];
  sheetName: string;
};

export type XlsxSheetOptions<K extends string> = {
  sheetNames: readonly string[];
  columns: readonly K[];
  required: readonly K[];
  requiredAnyOf?: ReadonlyArray<readonly K[]>;
  aliases?: Readonly<Record<string, K>>;
  maxRows: number;
};

export class XlsxImportParseError extends Error {}

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

export function parseImportNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s$%]/g, "");
  if (!cleaned) {
    return null;
  }

  let normalized = cleaned;
  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");
  if (hasDot && hasComma) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = /^-?[1-9]\d{0,2}(,\d{3})+$/.test(cleaned)
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  } else if (hasDot && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return Number.NaN;
  }
  return Number(normalized);
}

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function findWorksheet(workbook: ExcelJS.Workbook, sheetNames: readonly string[]) {
  for (const name of sheetNames) {
    const byName = workbook.getWorksheet(name);
    if (byName) {
      return byName;
    }
  }
  const normalizedNames = new Set(sheetNames.map((name) => normalizeHeader(name)));
  return (
    workbook.worksheets.find((sheet) => normalizedNames.has(normalizeHeader(sheet.name))) ??
    workbook.worksheets[0]
  );
}

export async function parseXlsxSheet<K extends string>(
  buffer: Buffer,
  options: XlsxSheetOptions<K>
): Promise<XlsxImportParseResult<K>> {
  const knownKeys = new Set<string>(options.columns);
  const aliases = options.aliases ?? {};
  const resolveHeaderKey = (header: string): K | null => {
    const normalized = normalizeHeader(header);
    if (knownKeys.has(normalized)) {
      return normalized as K;
    }
    return aliases[normalized] ?? null;
  };

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new XlsxImportParseError(
      "El archivo no es un .xlsx válido o está dañado."
    );
  }

  const worksheet = findWorksheet(workbook, options.sheetNames);
  if (!worksheet) {
    throw new XlsxImportParseError("El archivo no tiene hojas.");
  }

  const headerRow = worksheet.getRow(1);
  const columnKeys = new Map<number, K>();
  const ignoredHeaders: string[] = [];
  const seenKeys = new Set<K>();

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
      throw new XlsxImportParseError(
        `La columna "${key}" está repetida en el encabezado.`
      );
    }
    seenKeys.add(key);
    columnKeys.set(columnNumber, key);
  });

  const missing = options.required.filter((key) => !seenKeys.has(key));
  if (missing.length > 0) {
    throw new XlsxImportParseError(
      `Faltan columnas obligatorias en la hoja "${worksheet.name}": ${missing.join(", ")}.`
    );
  }
  for (const group of options.requiredAnyOf ?? []) {
    if (!group.some((key) => seenKeys.has(key))) {
      throw new XlsxImportParseError(
        `La hoja "${worksheet.name}" debe tener al menos una de estas columnas: ${group.join(", ")}.`
      );
    }
  }

  const rows: XlsxImportRawRow<K>[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: Partial<Record<K, string>> = {};
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
    if (rows.length > options.maxRows) {
      throw new XlsxImportParseError(
        `El archivo supera el máximo de ${options.maxRows} filas por carga.`
      );
    }
  }

  if (rows.length === 0) {
    throw new XlsxImportParseError(
      `La hoja "${worksheet.name}" no tiene filas con datos.`
    );
  }

  return { rows, ignoredHeaders, sheetName: worksheet.name };
}
