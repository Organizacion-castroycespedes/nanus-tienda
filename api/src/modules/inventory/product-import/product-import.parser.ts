import {
  parseXlsxSheet,
  XlsxImportParseError,
  type XlsxImportRawRow,
} from "../imports/xlsx-import.parser";
import {
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_MAX_ROWS,
  PRODUCT_IMPORT_REQUIRED_HEADERS,
  PRODUCT_IMPORT_SHEET_NAME,
  type ProductImportColumnKey,
} from "./product-import.columns";

export { cellValueToText, normalizeHeader } from "../imports/xlsx-import.parser";

export type ProductImportRawRow = XlsxImportRawRow<ProductImportColumnKey>;

export type ProductImportParseResult = {
  rows: ProductImportRawRow[];
  ignoredHeaders: string[];
};

export { XlsxImportParseError as ProductImportParseError };

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

export async function parseProductImportWorkbook(
  buffer: Buffer,
  options: { maxRows?: number } = {}
): Promise<ProductImportParseResult> {
  const result = await parseXlsxSheet<ProductImportColumnKey>(buffer, {
    sheetNames: [PRODUCT_IMPORT_SHEET_NAME],
    columns: PRODUCT_IMPORT_COLUMNS.map((column) => column.key),
    required: PRODUCT_IMPORT_REQUIRED_HEADERS,
    aliases: HEADER_ALIASES,
    maxRows: options.maxRows ?? PRODUCT_IMPORT_MAX_ROWS,
  });
  return { rows: result.rows, ignoredHeaders: result.ignoredHeaders };
}
