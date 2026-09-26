import ExcelJS from "exceljs";
import { cellValueToText, normalizeHeader } from "../imports/xlsx-import.parser";

export type ReportFiscalCategory =
  | "GENERAL"
  | "BEER"
  | "BEER_MIXTURE"
  | "DISTILLED_LIQUOR"
  | "WINE"
  | "WINE_APERITIF"
  | "LIQUOR_APERITIF";

export type InventoryReportRow = {
  sourceRow: number;
  code: string;
  name: string;
  variant: string;
  reference: string;
  type: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
};

export type InventoryReport = {
  exportDate: string | null;
  rows: InventoryReportRow[];
};

export type InventoryReportItem = {
  source: InventoryReportRow;
  sku: string;
  name: string;
  exists: boolean;
  barcode: string | null;
  gtinValid: boolean;
  category: string;
  subcategory: string;
  fiscal: ReportFiscalCategory;
  alcohol: number | null;
  volumeMl: number | null;
  danePrice: number | null;
  targetStock: number;
  notes: string[];
};

export type InventoryReportSkipped = {
  source: InventoryReportRow;
  reason: string;
};

export type InventoryReportPlan = {
  items: InventoryReportItem[];
  skipped: InventoryReportSkipped[];
};

export type InventoryReportPlanOptions = {
  skuPrefix: string;
  existingSkus: Set<string>;
  existingBarcodes: Map<string, string>;
};

export class InventoryReportFormatError extends Error {}

const DANE_FISCAL_CATEGORIES: ReportFiscalCategory[] = [
  "DISTILLED_LIQUOR",
  "WINE",
  "WINE_APERITIF",
  "LIQUOR_APERITIF",
];

const REPORT_COLUMNS = {
  code: ["codigo"],
  name: ["nombre"],
  variant: ["variantes", "variante"],
  reference: ["referencia"],
  type: ["tipo"],
  category: ["categoria"],
  cost: ["precio_costo", "costo"],
  price: ["precio_venta"],
  stock: ["existencia", "existencias", "stock"],
} as const;

const REQUIRED_REPORT_COLUMNS: Array<keyof typeof REPORT_COLUMNS> = [
  "code",
  "name",
  "cost",
  "price",
  "stock",
];

const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(raw: string) {
  const match = raw.replace(/\s/g, "").match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : 0;
}

export function parseReportDate(raw: string): string | null {
  const match = normalizeText(raw).match(/(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})/);
  if (!match) {
    return null;
  }
  const month = MONTHS[match[2]];
  if (!month) {
    return null;
  }
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

export async function parseInventoryReport(buffer: Buffer): Promise<InventoryReport> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new InventoryReportFormatError("El archivo no es un Excel .xlsx válido.");
  }

  for (const sheet of workbook.worksheets) {
    const scanLimit = Math.min(sheet.rowCount, 15);
    for (let headerRow = 1; headerRow <= scanLimit; headerRow += 1) {
      const headers = new Map<string, number>();
      sheet.getRow(headerRow).eachCell((cell, column) => {
        headers.set(normalizeHeader(cellValueToText(cell.value)), column);
      });
      const columns = Object.fromEntries(
        Object.entries(REPORT_COLUMNS).map(([key, aliases]) => [
          key,
          aliases.map((alias) => headers.get(alias)).find((column) => column !== undefined),
        ])
      ) as Record<keyof typeof REPORT_COLUMNS, number | undefined>;
      if (REQUIRED_REPORT_COLUMNS.some((key) => columns[key] === undefined)) {
        continue;
      }

      let exportDate: string | null = null;
      for (let row = 1; row < headerRow && !exportDate; row += 1) {
        sheet.getRow(row).eachCell((cell) => {
          exportDate ??= parseReportDate(cellValueToText(cell.value));
        });
      }

      const read = (row: ExcelJS.Row, column: number | undefined) =>
        column ? cellValueToText(row.getCell(column).value).trim() : "";
      const rows: InventoryReportRow[] = [];
      for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const code = read(row, columns.code);
        const name = read(row, columns.name);
        if (!code || !name || normalizeText(code) === "total") {
          continue;
        }
        rows.push({
          sourceRow: rowNumber,
          code,
          name,
          variant: read(row, columns.variant),
          reference: read(row, columns.reference),
          type: read(row, columns.type),
          category: read(row, columns.category),
          cost: parseNumber(read(row, columns.cost)),
          price: parseNumber(read(row, columns.price)),
          stock: parseNumber(read(row, columns.stock)),
        });
      }
      if (rows.length === 0) {
        throw new InventoryReportFormatError("El reporte no tiene productos.");
      }
      return { exportDate, rows };
    }
  }

  throw new InventoryReportFormatError(
    "No se encontró la fila de encabezados. El reporte debe tener las columnas Código, Nombre, Precio Costo, Precio Venta y Existencia."
  );
}

export function gtinIsValid(code: string) {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) {
    return false;
  }
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const NAME_FIXES: Array<[RegExp, string]> = [
  [/\bCEREVEZA\b/gi, "CERVEZA"],
  [/\bLIGTH\b/gi, "LIGHT"],
  [/\bamarrillo\b/gi, "amarillo"],
  [/\breposdo\b/gi, "reposado"],
  [/\bCliclets\b/gi, "Chiclets"],
  [/\bRothmanas\b/gi, "Rothmans"],
  [/\bsparlking\b/gi, "sparkling"],
  [/\bchiva regal\b/gi, "chivas regal"],
  [/\b1OOOML\b/gi, "1000ML"],
  [/\bUNIDA\b/g, "UNIDAD"],
  [/\bunida\b/g, "unidad"],
  [/\b1unid(a|ad)?\b/gi, "1 unidad"],
  [/\b250mg\b/gi, "250ml"],
];

function applyNameFixes(value: string) {
  return NAME_FIXES.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value.replace(/\s+/g, " ").trim()
  );
}

export function cleanProductName(name: string, variant: string) {
  const base = applyNameFixes(name);
  const variantText = variant.replace(/^FORMA DE COMPRA\s*-\s*/i, "").trim();
  if (!variantText || /^-+$/.test(variantText)) {
    return base;
  }
  return `${base} - ${applyNameFixes(variantText)}`;
}

export function packSize(name: string) {
  const text = normalizeText(name);
  if (/\bcanasta\b/.test(text)) {
    return 30;
  }
  if (/\bcaja\b/.test(text)) {
    return 24;
  }
  const match =
    text.match(/\b(\d{1,2})\s*(pack|unidades|und\b|al por mayor)/) ??
    text.match(/\bpor\s*(\d{1,2})\b/) ??
    text.match(/\b(6|12|24|30)\s*$/);
  const size = match ? Number(match[1]) : 1;
  return size > 1 ? size : 1;
}

export function unitVolumeMl(name: string): number | null {
  const text = normalizeText(name).replace(/(\d),(\d)/g, "$1.$2");
  const ml = text.match(/(\d+(?:\.\d+)?)\s*(ml|mililitros)\b/);
  if (ml) {
    const value = Number(ml[1]);
    return value < 10 ? Math.round(value * 1000) : Math.round(value);
  }
  const liters = text.match(/(\d+(?:\.\d+)?)\s*(lt|litro|litros|l)\b/);
  if (liters) {
    return Math.round(Number(liters[1]) * 1000);
  }
  if (/\b(lt|litro)\b/.test(text)) {
    return 1000;
  }
  const dotted = text.match(/\b(\d)\.(\d{3})\b/);
  if (dotted) {
    return Number(`${dotted[1]}${dotted[2]}`);
  }
  const bare = [...text.matchAll(/\b(\d{3,4})\b/g)]
    .map((match) => Number(match[1]))
    .find((value) => value >= 150 && value <= 3000);
  return bare ?? null;
}

type ClassificationRule = {
  test: RegExp;
  category: string;
  subcategory: string;
  fiscal: ReportFiscalCategory;
  alcohol?: number;
  defaultUnitMl?: number;
};

const CLASSIFICATION_RULES: ClassificationRule[] = [
  { test: /cigarr|\blucky\b|rothmans|\blym\b/, category: "Cigarrillos", subcategory: "Cigarrillos", fiscal: "GENERAL" },
  { test: /bonfiest/, category: "Droguería", subcategory: "Medicamentos", fiscal: "GENERAL" },
  { test: /bonbon|chiclets|trident/, category: "Confitería", subcategory: "Dulces y chicles", fiscal: "GENERAL" },
  { test: /tajin/, category: "Snacks", subcategory: "Condimentos", fiscal: "GENERAL" },
  { test: /todito|doritos|(?<!tequila )margarita (natural|pollo|limon)|papa margarita|cheetos|cheese tris|manimoto|gudiz/, category: "Snacks", subcategory: "Pasabocas", fiscal: "GENERAL" },
  { test: /\bhielo\b/, category: "Bebidas sin licor", subcategory: "Hielo", fiscal: "GENERAL" },
  { test: /red bull|speed max|vive 100/, category: "Bebidas sin licor", subcategory: "Energizantes", fiscal: "GENERAL" },
  { test: /electrolit|gatorade|hidratao/, category: "Bebidas sin licor", subcategory: "Hidratantes", fiscal: "GENERAL" },
  { test: /\bagua\b|h2oh/, category: "Bebidas sin licor", subcategory: "Aguas", fiscal: "GENERAL" },
  { test: /jugo hit|mr tea|hatsu/, category: "Bebidas sin licor", subcategory: "Jugos y tés", fiscal: "GENERAL" },
  { test: /\bpony\b|\bmalta\b/, category: "Bebidas sin licor", subcategory: "Maltas", fiscal: "GENERAL" },
  { test: /gaseosa|postobon|\bsoda\b|bretana/, category: "Bebidas sin licor", subcategory: "Gaseosas", fiscal: "GENERAL" },
  { test: /refajo|cola y pola/, category: "Licores", subcategory: "Refajos", fiscal: "BEER_MIXTURE", alcohol: 2.5, defaultUnitMl: 330 },
  { test: /crema de whisky|baileys/, category: "Licores", subcategory: "Cremas", fiscal: "LIQUOR_APERITIF", alcohol: 17, defaultUnitMl: 750 },
  { test: /jp pizzy/, category: "Licores", subcategory: "Cocteles y RTD", fiscal: "WINE_APERITIF", alcohol: 7, defaultUnitMl: 275 },
  { test: /four lo(k|c)o/, category: "Licores", subcategory: "Cocteles y RTD", fiscal: "LIQUOR_APERITIF", alcohol: 5, defaultUnitMl: 473 },
  { test: /smirnoff ice|smirnoff spicy|los cuates|like ice|sparkling tamarindo/, category: "Licores", subcategory: "Cocteles y RTD", fiscal: "LIQUOR_APERITIF", alcohol: 5, defaultUnitMl: 275 },
  { test: /\bvino\b|espum/, category: "Licores", subcategory: "Vinos", fiscal: "WINE", alcohol: 12, defaultUnitMl: 750 },
  { test: /tequila|\btq\b|jimador|jose cuervo/, category: "Licores", subcategory: "Tequilas", fiscal: "DISTILLED_LIQUOR", alcohol: 38, defaultUnitMl: 750 },
  { test: /vodka|wodka|absolut|smirnoff/, category: "Licores", subcategory: "Vodkas", fiscal: "DISTILLED_LIQUOR", alcohol: 30, defaultUnitMl: 750 },
  { test: /\bron\b|bacardi/, category: "Licores", subcategory: "Rones", fiscal: "DISTILLED_LIQUOR", alcohol: 35, defaultUnitMl: 750 },
  { test: /aguardiente/, category: "Licores", subcategory: "Aguardientes", fiscal: "DISTILLED_LIQUOR", alcohol: 29, defaultUnitMl: 750 },
  { test: /whisky|old parr|buchanan|johnnie|black white|chivas|glenlivet|grouse|jack daniel|something special|passport/, category: "Licores", subcategory: "Whisky", fiscal: "DISTILLED_LIQUOR", alcohol: 40, defaultUnitMl: 750 },
  { test: /cerveza|aguila|poker|club colombia|corona|budweiser|\bred\b|costen|stella|michelob|heineken|miller|modelo|andina|\bsol\b|central/, category: "Licores", subcategory: "Cervezas", fiscal: "BEER", alcohol: 4, defaultUnitMl: 330 },
];

const BEER_FALLBACK: ClassificationRule = {
  test: /./,
  category: "Licores",
  subcategory: "Cervezas",
  fiscal: "BEER",
  alcohol: 4,
  defaultUnitMl: 330,
};

export function classifyProduct(name: string, sourceCategory: string) {
  const text = normalizeText(name);
  const rule =
    CLASSIFICATION_RULES.find((item) => item.test.test(text)) ??
    (normalizeText(sourceCategory) === "cerveza" ? BEER_FALLBACK : undefined);
  if (!rule) {
    return null;
  }
  if (rule.subcategory === "Cervezas" && /\bcero\b/.test(text)) {
    return { ...rule, fiscal: "GENERAL" as const, alcohol: undefined, zeroAlcohol: true };
  }
  return { ...rule, zeroAlcohol: false };
}

function resolveBarcode(
  source: InventoryReportRow,
  sku: string,
  options: InventoryReportPlanOptions,
  assigned: Map<string, string>,
  notes: string[]
) {
  let barcode: string | null = null;
  if (/^\d{8,14}$/.test(source.code)) {
    barcode = source.code;
  } else if (/^\d{8,14}$/.test(source.reference)) {
    barcode = source.reference;
    notes.push("Código de barras tomado de la columna Referencia.");
  }
  if (!barcode) {
    return null;
  }
  const owner = options.existingBarcodes.get(barcode);
  if (owner && owner !== sku.toUpperCase()) {
    notes.push(`El código de barras ${barcode} ya pertenece a ${owner}: no se asigna.`);
    return null;
  }
  const repeated = assigned.get(barcode);
  if (repeated) {
    notes.push(`El código de barras ${barcode} se repite con ${repeated}: no se asigna.`);
    return null;
  }
  assigned.set(barcode, sku);
  return barcode;
}

export function planInventoryReport(
  rows: InventoryReportRow[],
  options: InventoryReportPlanOptions
): InventoryReportPlan {
  const items: InventoryReportItem[] = [];
  const skipped: InventoryReportSkipped[] = [];
  const assignedBarcodes = new Map<string, string>();
  const seenSkus = new Map<string, number>();

  for (const source of rows) {
    if (/^DEL\d+/i.test(source.code)) {
      skipped.push({ source, reason: "Código DEL: producto eliminado en el sistema de origen." });
      continue;
    }
    if (source.type && normalizeText(source.type) !== "inventariable") {
      skipped.push({ source, reason: `Tipo "${source.type}": no maneja inventario.` });
      continue;
    }
    const sku = `${options.skuPrefix}${source.code}`;
    const firstRow = seenSkus.get(sku.toUpperCase());
    if (firstRow !== undefined) {
      skipped.push({ source, reason: `Código repetido: ya viene en la fila ${firstRow}.` });
      continue;
    }
    seenSkus.set(sku.toUpperCase(), source.sourceRow);

    const notes: string[] = [];
    const exists = options.existingSkus.has(sku.toUpperCase());
    if (exists) {
      notes.push("Ya existe: se actualiza y conserva sus impuestos.");
    }
    const name = cleanProductName(source.name, source.variant);
    if (name !== source.name.replace(/\s+/g, " ").trim()) {
      notes.push(`Nombre ajustado (origen: "${source.name}").`);
    }

    const barcode = resolveBarcode(source, sku, options, assignedBarcodes, notes);
    const gtinValid = barcode ? gtinIsValid(barcode) : false;
    if (barcode && !gtinValid) {
      notes.push(`El código ${barcode} no es un GTIN válido: el estándar DIAN queda en 999.`);
    }

    const rule = classifyProduct(name, source.category);
    if (!rule) {
      notes.push("No se pudo deducir la categoría: queda en General / Otros.");
    }
    const fiscal: ReportFiscalCategory = rule?.fiscal ?? "GENERAL";
    let alcohol: number | null = null;
    let volumeMl: number | null = null;
    let danePrice: number | null = null;
    if (fiscal !== "GENERAL" && !exists) {
      const deduced = unitVolumeMl(name);
      const unit = deduced ?? rule?.defaultUnitMl ?? null;
      const pack = packSize(name);
      alcohol = rule?.alcohol ?? null;
      volumeMl = unit ? unit * pack : null;
      const packText = pack > 1 ? ` (${pack} x ${unit} ml)` : "";
      notes.push(
        `Grado ${alcohol}% estimado por tipo; volumen ${volumeMl ?? "?"} ml${packText} ${deduced ? "deducido del nombre" : "estándar del tipo"}.`
      );
      if (DANE_FISCAL_CATEGORIES.includes(fiscal)) {
        danePrice = source.price;
        notes.push("precio_dane provisional = precio de venta: reemplazar por el precio DANE certificado.");
      }
    }
    if (rule?.zeroAlcohol) {
      notes.push("Cerveza sin alcohol: se carga como GENERAL con IVA 19%.");
    }
    if (rule?.category === "Cigarrillos") {
      notes.push("Revisar el impuesto al consumo de tabaco.");
    }
    if (rule?.category === "Droguería") {
      notes.push("Revisar si el medicamento está excluido de IVA.");
    }
    const looksLikePack =
      packSize(name) === 1 &&
      ((rule?.subcategory === "Cervezas" && source.price >= 20000) ||
        (rule?.category === "Bebidas sin licor" && source.price >= 10000));
    if (looksLikePack) {
      notes.push(`El precio (${source.price}) parece de un paquete y el nombre no lo dice: revisar.`);
    }
    if (source.cost <= 0) {
      notes.push("Costo en 0 en el origen.");
    }
    if (source.price < source.cost) {
      notes.push("Precio de venta menor que el costo.");
    }
    if (source.stock < 0) {
      notes.push(`Existencia negativa en el origen (${source.stock}): el stock se carga en 0.`);
    }

    items.push({
      source,
      sku,
      name,
      exists,
      barcode,
      gtinValid,
      category: rule?.category ?? "General",
      subcategory: rule?.subcategory ?? "Otros",
      fiscal,
      alcohol,
      volumeMl,
      danePrice,
      targetStock: Math.max(0, source.stock),
      notes,
    });
  }

  return { items, skipped };
}

export async function buildBlankTemplate(
  sheetName: string,
  keys: readonly string[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Manus Tienda";
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = keys.map((key) => ({
    header: key,
    key,
    width: key === "nombre" ? 40 : Math.max(14, key.length + 4),
  }));
  sheet.getRow(1).font = { bold: true };
  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

function headerColumns(sheet: ExcelJS.Worksheet) {
  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    columns.set(normalizeHeader(cellValueToText(cell.value)), column);
  });
  return columns;
}

function writeRow(
  sheet: ExcelJS.Worksheet,
  columns: Map<string, number>,
  rowNumber: number,
  values: Record<string, string | number | null>
) {
  const row = sheet.getRow(rowNumber);
  for (const [key, value] of Object.entries(values)) {
    const column = columns.get(key);
    if (column && value !== null && value !== undefined && value !== "") {
      row.getCell(column).value = value;
    }
  }
  row.commit();
}

export async function fillProductTemplate(
  template: Buffer,
  plan: InventoryReportPlan
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet("Productos");
  if (!sheet) {
    throw new InventoryReportFormatError("La plantilla de productos no tiene la hoja Productos.");
  }
  const columns = headerColumns(sheet);

  plan.items.forEach((item, index) => {
    const useGtin = Boolean(item.barcode && item.gtinValid);
    writeRow(sheet, columns, index + 2, {
      sku: item.sku,
      nombre: item.name,
      unidad: "UND",
      modelo_venta: "UNIDAD",
      unidad_comercial: "UND",
      precio_venta: item.source.price,
      costo: item.source.cost,
      codigo_barras: item.barcode,
      estandar_dian: useGtin ? "010" : null,
      codigo_estandar_dian: useGtin ? item.barcode : null,
      categoria: item.category,
      subcategoria: item.subcategory,
      activo: "SI",
      ...(item.exists
        ? {}
        : {
            categoria_fiscal: item.fiscal,
            iva: item.fiscal === "GENERAL" ? 19 : null,
            grado_alcohol: item.alcohol,
            volumen_ml: item.volumeMl,
            precio_dane: item.danePrice,
          }),
    });
  });

  const review = workbook.addWorksheet("Revision", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  review.columns = [
    { header: "fila_origen", key: "row", width: 12 },
    { header: "codigo_origen", key: "code", width: 26 },
    { header: "sku", key: "sku", width: 26 },
    { header: "nombre", key: "name", width: 50 },
    { header: "accion", key: "action", width: 12 },
    { header: "categoria", key: "category", width: 32 },
    { header: "fiscal", key: "fiscal", width: 18 },
    { header: "existencia_origen", key: "stock", width: 17 },
    { header: "observaciones", key: "notes", width: 120 },
  ];
  review.getRow(1).font = { bold: true };
  for (const item of plan.items) {
    review.addRow({
      row: item.source.sourceRow,
      code: item.source.code,
      sku: item.sku,
      name: item.name,
      action: item.exists ? "ACTUALIZA" : "CREA",
      category: `${item.category} / ${item.subcategory}`,
      fiscal: item.exists ? "(sin cambio)" : item.fiscal,
      stock: item.source.stock,
      notes: item.notes.join(" "),
    });
  }
  for (const skipped of plan.skipped) {
    review.addRow({
      row: skipped.source.sourceRow,
      code: skipped.source.code,
      name: skipped.source.name,
      action: "OMITIDO",
      stock: skipped.source.stock,
      notes: skipped.reason,
    });
  }

  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

export async function fillStockTemplate(
  template: Buffer,
  plan: InventoryReportPlan,
  options: { branchCode: string; currentStock?: Map<string, number> }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet("Carga_Inicial");
  if (!sheet) {
    throw new InventoryReportFormatError("La plantilla de stock no tiene la hoja Carga_Inicial.");
  }
  const columns = headerColumns(sheet);

  plan.items.forEach((item, index) => {
    writeRow(sheet, columns, index + 2, {
      sku: item.sku,
      nombre: item.name,
      sucursal: options.branchCode,
      stock_actual: options.currentStock
        ? options.currentStock.get(item.sku.toUpperCase()) ?? 0
        : null,
      cantidad: item.targetStock,
    });
  });

  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}
