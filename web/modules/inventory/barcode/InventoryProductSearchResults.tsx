"use client";

import type { InventorySearchableProduct } from "./inventory-product-search";

type InventoryProductSearchResultsProps<T extends InventorySearchableProduct> = {
  products: readonly T[];
  title: string;
  emptyMessage?: string;
  onSelect: (product: T) => void;
  /** Texto adicional por producto (stock, pendiente, etc.). */
  renderMeta?: (product: T) => string | null;
};

export const InventoryProductSearchResults = <T extends InventorySearchableProduct>({
  products,
  title,
  emptyMessage,
  onSelect,
  renderMeta,
}: InventoryProductSearchResultsProps<T>) => {
  if (products.length === 0) {
    return emptyMessage ? (
      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {emptyMessage}
      </p>
    ) : null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
        {title}
      </p>
      <ul aria-label={title} className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        {products.map((product) => {
          const meta = renderMeta?.(product);
          return (
            <li key={product.id}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
                onClick={() => onSelect(product)}
              >
                <span className="break-words text-sm font-medium text-slate-900 dark:text-white">
                  {product.name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {[product.sku, product.primaryBarcode, meta].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
