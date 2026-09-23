"use client";

import { ImageIcon } from "lucide-react";
import { InventoryImagePreview } from "../InventoryImagePreview";

type ProductSummaryCardProps = {
  name: string;
  sku: string;
  isActive: boolean;
  imageUrl?: string | null;
  onChangeImageClick?: () => void;
};

export const ProductSummaryCard = ({
  name,
  sku,
  isActive,
  imageUrl,
  onChangeImageClick,
}: ProductSummaryCardProps) => (
  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5">
    <div className="flex min-w-0 items-center gap-4">
      <InventoryImagePreview
        imageUrl={imageUrl}
        altText={name || "Producto"}
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 bg-cover bg-center text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
        fallback={<ImageIcon className="h-7 w-7" aria-hidden />}
      />
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold text-slate-900 dark:text-white">
          {name || "Sin nombre"}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <span>SKU: {sku || "-"}</span>
          {isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Activo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Inactivo
            </span>
          )}
        </div>
      </div>
    </div>
    {onChangeImageClick ? (
      <button
        type="button"
        onClick={onChangeImageClick}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        Cambiar imagen
      </button>
    ) : null}
  </div>
);
