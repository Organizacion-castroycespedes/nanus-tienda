import type { ProductResponse } from "../../../domains/products/dtos";
import { normalizeInventoryBarcode } from "./barcode-resolver";

/** Búsqueda manual por nombre, SKU o código para pedidos y compras. */

export type InventorySearchableProduct = Pick<
  ProductResponse,
  "id" | "name" | "sku" | "primaryBarcode" | "barcodeCodes" | "barcodes"
>;

export const INVENTORY_SEARCH_MIN_LENGTH = 2;
export const INVENTORY_SEARCH_DEFAULT_LIMIT = 8;

const buildSearchText = (product: InventorySearchableProduct) =>
  normalizeInventoryBarcode(
    [
      product.name,
      product.sku,
      product.primaryBarcode,
      ...(product.barcodeCodes ?? []),
      ...(product.barcodes ?? []).filter((item) => item.isActive !== false).map((item) => item.barcode),
    ]
      .filter(Boolean)
      .join(" ")
  );

/**
 * Devuelve hasta `limit` productos cuyo texto contiene todas las palabras de la
 * consulta. Las coincidencias que empiezan por la consulta van primero.
 */
export const searchInventoryProducts = <T extends InventorySearchableProduct>(
  products: readonly T[],
  query: string,
  limit: number = INVENTORY_SEARCH_DEFAULT_LIMIT
): T[] => {
  const normalized = normalizeInventoryBarcode(query);
  if (normalized.length < INVENTORY_SEARCH_MIN_LENGTH) {
    return [];
  }
  const terms = normalized.split(/\s+/).filter(Boolean);

  const scored: Array<{ product: T; score: number }> = [];
  for (const product of products) {
    const text = buildSearchText(product);
    if (!terms.every((term) => text.includes(term))) {
      continue;
    }
    const name = normalizeInventoryBarcode(product.name);
    scored.push({ product, score: name.startsWith(normalized) ? 0 : text.startsWith(normalized) ? 1 : 2 });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.product.name.localeCompare(b.product.name, "es"))
    .slice(0, limit)
    .map((item) => item.product);
};
