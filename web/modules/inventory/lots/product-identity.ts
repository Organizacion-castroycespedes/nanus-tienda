/**
 * Identificación de producto en Inventario > Lotes
 * (change modernizar-inventario-lotes-ubicaciones, D3).
 */

export const UNRESOLVED_PRODUCT_NAME = "Producto no disponible";
export const UNRESOLVED_PRODUCT_SKU = "—";

export type CatalogProduct = { name: string; sku?: string | null };

export type ProductIdentitySource = {
  productId: string;
  productName?: string | null;
  productSku?: string | null;
};

export type ProductIdentity = {
  name: string;
  sku: string;
  resolved: boolean;
};

const clean = (value: string | null | undefined) => value?.trim() || null;

/** Respuesta de la API primero; catálogo como respaldo; nunca el UUID. */
export const resolveProductIdentity = (
  source: ProductIdentitySource,
  catalog: ReadonlyMap<string, CatalogProduct>
): ProductIdentity => {
  const responseName = clean(source.productName);
  if (responseName) {
    return {
      name: responseName,
      sku: clean(source.productSku) ?? UNRESOLVED_PRODUCT_SKU,
      resolved: true,
    };
  }

  const product = catalog.get(source.productId);
  const catalogName = clean(product?.name);
  if (catalogName) {
    return {
      name: catalogName,
      sku: clean(product?.sku) ?? UNRESOLVED_PRODUCT_SKU,
      resolved: true,
    };
  }

  return {
    name: UNRESOLVED_PRODUCT_NAME,
    sku: UNRESOLVED_PRODUCT_SKU,
    resolved: false,
  };
};

/** Productos del resultado sin nombre en la respuesta ni en el catálogo. */
export const collectMissingProductIds = (
  sources: readonly ProductIdentitySource[],
  catalog: ReadonlyMap<string, CatalogProduct>
) => {
  const missing = new Set<string>();
  sources.forEach((source) => {
    if (!clean(source.productName) && !clean(catalog.get(source.productId)?.name)) {
      missing.add(source.productId);
    }
  });
  return Array.from(missing);
};

/** Ejecuta `task` sobre `items` con un máximo de `limit` en paralelo. */
export const runWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    worker
  );
  await Promise.all(workers);
  return results;
};

/** Búsqueda sin distinguir mayúsculas sobre los textos visibles de la fila. */
export const matchesLotSearch = (
  query: string,
  fields: readonly (string | null | undefined)[]
) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return fields.some((field) => (field ?? "").toLowerCase().includes(normalized));
};
