export const STOCK_IMPORT_SHEET_NAME = "Carga_Inicial";
export const STOCK_IMPORT_SHEET_NAMES = [STOCK_IMPORT_SHEET_NAME, "Stock"] as const;
export const STOCK_IMPORT_MAX_ROWS = 10000;
export const STOCK_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const STOCK_IMPORT_REFERENCE_TABLE = "stock_initial_load";

export type StockImportColumn = {
  key: string;
  required: boolean;
  informative?: boolean;
  description: string;
  example: string | number;
};

export const STOCK_IMPORT_COLUMNS = [
  {
    key: "sku",
    required: false,
    description:
      "SKU del producto. Obligatorio si no viene codigo_barras ni producto_id.",
    example: "AGUARDIENTE003",
  },
  {
    key: "codigo_barras",
    required: false,
    description: "Código de barras activo del producto (alternativa al SKU).",
    example: "7702049000011",
  },
  {
    key: "producto_id",
    required: false,
    description: "UUID del producto (alternativa al SKU).",
    example: "",
  },
  {
    key: "nombre",
    required: false,
    informative: true,
    description: "Solo informativo. No se usa para buscar el producto.",
    example: "Aguardiente Amarillo 1000ml",
  },
  {
    key: "sucursal",
    required: false,
    description:
      "Código de la sucursal (hoja Catalogos). Puede ir vacío si la empresa tiene una sola sucursal activa.",
    example: "PRINCIPAL",
  },
  {
    key: "sucursal_id",
    required: false,
    description: "UUID de la sucursal (alternativa al código).",
    example: "",
  },
  {
    key: "stock_actual",
    required: false,
    informative: true,
    description: "Solo informativo: stock al descargar la plantilla.",
    example: 12,
  },
  {
    key: "cantidad",
    required: true,
    description:
      "Stock objetivo (>= 0). El sistema calcula la diferencia con el stock actual y registra una entrada o salida. Si va vacía, la fila se omite.",
    example: 24,
  },
  {
    key: "costo_unitario",
    required: false,
    description:
      "Costo unitario del lote nuevo. Se ignora en productos sin lote y en lotes existentes.",
    example: 1250,
  },
  {
    key: "lote_codigo",
    required: false,
    description:
      "Código del lote. Obligatorio si el producto maneja lote; no se permite si no lo maneja.",
    example: "LOT-1",
  },
  {
    key: "fecha_vencimiento",
    required: false,
    description:
      "Fecha de vencimiento del lote (YYYY-MM-DD). Obligatoria si el producto requiere vencimiento.",
    example: "2026-12-31",
  },
] as const satisfies readonly StockImportColumn[];

export type StockImportColumnKey = (typeof STOCK_IMPORT_COLUMNS)[number]["key"];

export const STOCK_IMPORT_REQUIRED_HEADERS: StockImportColumnKey[] = ["cantidad"];

export const STOCK_IMPORT_TEMPLATE_KEYS: StockImportColumnKey[] = [
  "sku",
  "nombre",
  "sucursal",
  "stock_actual",
  "cantidad",
  "costo_unitario",
  "lote_codigo",
  "fecha_vencimiento",
];

export const STOCK_IMPORT_PRODUCT_HEADERS: StockImportColumnKey[] = [
  "sku",
  "codigo_barras",
  "producto_id",
];

export const STOCK_IMPORT_HEADER_ALIASES: Record<string, StockImportColumnKey> = {
  codigo: "sku",
  codigo_producto: "sku",
  codigo_de_barras: "codigo_barras",
  barcode: "codigo_barras",
  product_id: "producto_id",
  producto: "nombre",
  nombre_producto: "nombre",
  codigo_sucursal: "sucursal",
  branch_id: "sucursal_id",
  stock: "stock_actual",
  cantidad_objetivo: "cantidad",
  conteo: "cantidad",
  costo: "costo_unitario",
  lote: "lote_codigo",
  vencimiento: "fecha_vencimiento",
};
