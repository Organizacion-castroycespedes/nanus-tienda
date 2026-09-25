export const PRODUCT_IMPORT_SHEET_NAME = "Productos";
export const PRODUCT_IMPORT_MAX_ROWS = 2000;
export const PRODUCT_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

export type ProductImportColumnGroup =
  | "Producto"
  | "Clasificación"
  | "Fiscal"
  | "Configuración"
  | "Stock inicial";

export type ProductImportColumn = {
  key: string;
  group: ProductImportColumnGroup;
  required: boolean;
  description: string;
  example: string | number;
};

export const PRODUCT_IMPORT_COLUMNS = [
  {
    key: "sku",
    group: "Producto",
    required: true,
    description:
      "Código interno único por empresa. Si ya existe, el producto se actualiza.",
    example: "AGUARDIENTE003",
  },
  {
    key: "nombre",
    group: "Producto",
    required: true,
    description: "Nombre visible del producto.",
    example: "Aguardiente Amarillo 1000ml",
  },
  {
    key: "descripcion",
    group: "Producto",
    required: false,
    description: "Descripción opcional.",
    example: "",
  },
  {
    key: "unidad",
    group: "Producto",
    required: true,
    description:
      "Abreviatura o nombre de una unidad que ya exista (ver hoja Catalogos).",
    example: "UND",
  },
  {
    key: "modelo_venta",
    group: "Producto",
    required: false,
    description: "UNIDAD, PESO o MIXTO. Por defecto UNIDAD.",
    example: "UNIDAD",
  },
  {
    key: "unidad_comercial",
    group: "Producto",
    required: false,
    description:
      "UND para UNIDAD. KG, LB, G u OZ para PESO o MIXTO. Por defecto UND o KG.",
    example: "UND",
  },
  {
    key: "precio_venta",
    group: "Producto",
    required: true,
    description:
      "Precio final al cliente. Obligatorio al crear; al actualizar, si cambia se registra en el historial de precios.",
    example: 85000,
  },
  {
    key: "costo",
    group: "Producto",
    required: true,
    description: "Costo del producto. Obligatorio al crear.",
    example: 62000,
  },
  {
    key: "codigo_barras",
    group: "Producto",
    required: false,
    description: "Código de barras principal (EAN/UPC). Opcional.",
    example: "7702168420135",
  },
  {
    key: "estandar_dian",
    group: "Producto",
    required: false,
    description:
      "001, 010, 020 o 999. Si se omite al crear, se usa 999 con el SKU.",
    example: "999",
  },
  {
    key: "codigo_estandar_dian",
    group: "Producto",
    required: false,
    description: "Código del estándar DIAN. Con 999 vacío se usa el SKU.",
    example: "",
  },
  {
    key: "categoria",
    group: "Clasificación",
    required: false,
    description: "Categoría del catálogo. Si no existe, se crea.",
    example: "Licores",
  },
  {
    key: "subcategoria",
    group: "Clasificación",
    required: false,
    description:
      "Subcategoría dentro de la categoría. Si no existe, se crea. Requiere categoria.",
    example: "Aguardiente",
  },
  {
    key: "iva",
    group: "Fiscal",
    required: false,
    description:
      "Tarifa de IVA: 19, 5, 0 o EXENTO. Vacío: se toma según la categoría fiscal.",
    example: 5,
  },
  {
    key: "categoria_fiscal",
    group: "Fiscal",
    required: false,
    description:
      "Categoría fiscal (código o nombre, ver hoja Catalogos). Vacío: GENERAL.",
    example: "DISTILLED_LIQUOR",
  },
  {
    key: "grado_alcohol",
    group: "Fiscal",
    required: false,
    description: "Grado alcohólico. Obligatorio para bebidas alcohólicas.",
    example: 29,
  },
  {
    key: "volumen_ml",
    group: "Fiscal",
    required: false,
    description: "Volumen neto en ml. Obligatorio para bebidas alcohólicas.",
    example: 1000,
  },
  {
    key: "precio_dane",
    group: "Fiscal",
    required: false,
    description:
      "Precio certificado DANE. Obligatorio cuando aplica impuesto ad valórem.",
    example: 85000,
  },
  {
    key: "requiere_lote",
    group: "Configuración",
    required: false,
    description: "SI o NO. Por defecto NO.",
    example: "SI",
  },
  {
    key: "requiere_vencimiento",
    group: "Configuración",
    required: false,
    description: "SI o NO. Si es SI, el lote queda marcado automáticamente.",
    example: "SI",
  },
  {
    key: "perecedero",
    group: "Configuración",
    required: false,
    description: "SI o NO. Requiere lote o vencimiento.",
    example: "NO",
  },
  {
    key: "stock_minimo",
    group: "Configuración",
    required: false,
    description: "Stock mínimo objetivo.",
    example: 1,
  },
  {
    key: "stock_maximo",
    group: "Configuración",
    required: false,
    description: "Stock máximo objetivo.",
    example: 100,
  },
  {
    key: "activo",
    group: "Configuración",
    required: false,
    description: "SI o NO. Por defecto SI.",
    example: "SI",
  },
  {
    key: "sucursal",
    group: "Stock inicial",
    required: false,
    description:
      "Código o nombre de la sucursal. Obligatorio si se carga stock y hay más de una sucursal.",
    example: "PRINCIPAL",
  },
  {
    key: "cantidad",
    group: "Stock inicial",
    required: false,
    description: "Cantidad positiva a cargar. Vacío: no se carga stock.",
    example: 12,
  },
  {
    key: "costo_unitario",
    group: "Stock inicial",
    required: false,
    description: "Costo unitario del lote. Solo aplica si el producto maneja lote.",
    example: 62000,
  },
  {
    key: "lote_codigo",
    group: "Stock inicial",
    required: false,
    description: "Obligatorio cuando el producto maneja lote.",
    example: "LOT-1",
  },
  {
    key: "fecha_vencimiento",
    group: "Stock inicial",
    required: false,
    description: "Formato YYYY-MM-DD. Obligatorio si requiere vencimiento.",
    example: "2027-06-30",
  },
] as const satisfies readonly ProductImportColumn[];

export type ProductImportColumnKey =
  (typeof PRODUCT_IMPORT_COLUMNS)[number]["key"];

export const PRODUCT_IMPORT_REQUIRED_HEADERS = PRODUCT_IMPORT_COLUMNS.filter(
  (column) => column.required
).map((column) => column.key);
