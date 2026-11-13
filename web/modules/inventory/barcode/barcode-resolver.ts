import type { ProductBarcodeType, ProductResponse } from "../../../domains/products/dtos";

/**
 * Resolución de códigos escaneados para pedidos y compras (HU-SCAN-001, D3).
 * Distingue coincidencia única, código ambiguo, código inexistente y
 * presentaciones (caja/paquete) sin factor de conversión.
 */

export type InventoryBarcodeProduct = Pick<
  ProductResponse,
  "id" | "sku" | "primaryBarcode" | "barcodeCodes" | "barcodes"
>;

export type InventoryBarcodeResolution<T extends InventoryBarcodeProduct> =
  | { kind: "MATCH"; code: string; product: T }
  | { kind: "AMBIGUOUS"; code: string; candidates: T[] }
  | { kind: "NOT_FOUND"; code: string }
  | {
      kind: "PRESENTATION_UNSUPPORTED";
      code: string;
      product: T;
      barcodeType: ProductBarcodeType;
    };

export type InventoryScopedBarcodeResolution<T extends InventoryBarcodeProduct> =
  | InventoryBarcodeResolution<T>
  | { kind: "OUT_OF_SCOPE"; code: string; product: T };

export const UNSUPPORTED_PRESENTATION_TYPES: ReadonlySet<ProductBarcodeType> = new Set([
  "PACKAGE",
  "BOX",
]);

export const normalizeInventoryBarcode = (value?: string | null) =>
  typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .toLowerCase()
    : "";

type ProductCodeEntry = { code: string; barcodeType: ProductBarcodeType | null };

const collectProductCodes = (product: InventoryBarcodeProduct): ProductCodeEntry[] => {
  const entries: ProductCodeEntry[] = [];
  const push = (value: string | null | undefined, barcodeType: ProductBarcodeType | null) => {
    const code = normalizeInventoryBarcode(value);
    if (code) {
      entries.push({ code, barcodeType });
    }
  };

  for (const barcode of product.barcodes ?? []) {
    if (barcode.isActive === false) {
      continue;
    }
    push(barcode.barcode, barcode.barcodeType ?? null);
    push(barcode.code, barcode.barcodeType ?? null);
  }
  for (const code of product.barcodeCodes ?? []) {
    push(code, null);
  }
  push(product.primaryBarcode, null);
  push(product.sku, null);

  return entries;
};

/** Tipo de barcode con el que coincide el código, priorizando el dato tipado. */
const findMatchedBarcodeType = (entries: ProductCodeEntry[], code: string) => {
  const typed = entries.find((entry) => entry.code === code && entry.barcodeType !== null);
  return typed?.barcodeType ?? null;
};

export const resolveInventoryBarcode = <T extends InventoryBarcodeProduct>(
  rawCode: string,
  products: readonly T[]
): InventoryBarcodeResolution<T> => {
  const code = normalizeInventoryBarcode(rawCode);
  const displayCode = rawCode.trim();
  if (!code) {
    return { kind: "NOT_FOUND", code: displayCode };
  }

  const matches: Array<{ product: T; barcodeType: ProductBarcodeType | null }> = [];
  for (const product of products) {
    const entries = collectProductCodes(product);
    if (entries.some((entry) => entry.code === code)) {
      matches.push({ product, barcodeType: findMatchedBarcodeType(entries, code) });
    }
  }

  if (matches.length === 0) {
    return { kind: "NOT_FOUND", code: displayCode };
  }
  if (matches.length > 1) {
    return {
      kind: "AMBIGUOUS",
      code: displayCode,
      candidates: matches.map((match) => match.product),
    };
  }

  const [match] = matches;
  if (match.barcodeType && UNSUPPORTED_PRESENTATION_TYPES.has(match.barcodeType)) {
    return {
      kind: "PRESENTATION_UNSUPPORTED",
      code: displayCode,
      product: match.product,
      barcodeType: match.barcodeType,
    };
  }

  return { kind: "MATCH", code: displayCode, product: match.product };
};

/**
 * Resuelve dentro de un subconjunto (por ejemplo, los productos de una compra).
 * Si el código no está en el subconjunto pero sí en el catálogo completo,
 * devuelve OUT_OF_SCOPE para informar que el producto no pertenece al documento.
 */
export const resolveInventoryBarcodeInScope = <T extends InventoryBarcodeProduct>(
  rawCode: string,
  scopeProducts: readonly T[],
  catalogProducts: readonly T[]
): InventoryScopedBarcodeResolution<T> => {
  const scoped = resolveInventoryBarcode(rawCode, scopeProducts);
  if (scoped.kind !== "NOT_FOUND") {
    return scoped;
  }

  const catalog = resolveInventoryBarcode(rawCode, catalogProducts);
  if (catalog.kind === "MATCH" || catalog.kind === "PRESENTATION_UNSUPPORTED") {
    return { kind: "OUT_OF_SCOPE", code: catalog.code, product: catalog.product };
  }

  return scoped;
};
