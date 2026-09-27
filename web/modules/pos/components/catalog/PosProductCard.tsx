"use client";

import React, { memo } from "react";
import { Plus, Scale } from "lucide-react";
import type { ProductResponse } from "../../../../domains/products/dtos";
import { InventoryImagePreview } from "../../../inventory/components/InventoryImagePreview";
import {
  getProductSaleType,
  productSaleTypeLabels,
} from "../../utils/product-classification";

type EffectiveImage = {
  imageUrl?: string | null;
  altText?: string | null;
};

type PosProductCardProps = {
  product: ProductResponse;
  viewMode: "grid" | "list";
  quantityInCart: number;
  stock: number;
  isProductActionDisabled: boolean;
  requiresScale: boolean;
  scaleMockEnabled: boolean;
  scaleReading: boolean;
  effectiveImage: EffectiveImage;
  formattedPrice: string;
  onAction: (product: ProductResponse) => void;
};

const isLowStock = (stock: number) => stock > 0 && stock <= 5;

const getProductStockTone = (stock: number) => {
  if (stock <= 0) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
  }
  if (isLowStock(stock)) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
};

const buildImageLabel = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "PR";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const PosProductCard = memo(
  ({
    product,
    viewMode,
    quantityInCart,
    stock,
    isProductActionDisabled,
    requiresScale,
    scaleMockEnabled,
    effectiveImage,
    formattedPrice,
    onAction,
  }: PosProductCardProps) => {
    const productSaleType = getProductSaleType(product);
    const hasProductInCart = quantityInCart > 0;
    const actionLabel = requiresScale
      ? scaleMockEnabled
        ? "Leer balanza"
        : "Sin balanza"
      : "Agregar";
    const actionTone = requiresScale
      ? scaleMockEnabled
        ? "bg-sky-600 text-white shadow-sm ring-1 ring-sky-500/20 group-hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:group-hover:bg-sky-400"
        : "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
      : "bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/20 group-hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:group-hover:bg-blue-400";

    if (viewMode === "list") {
      return (
        <button
          type="button"
          onClick={() => onAction(product)}
          disabled={isProductActionDisabled}
          className={`group w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:border-slate-200 disabled:hover:shadow-sm dark:bg-slate-800 dark:hover:border-slate-700 ${
            hasProductInCart
              ? "border-blue-200 ring-2 ring-blue-100 dark:border-blue-500/40 dark:ring-blue-500/10"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <div className="grid min-h-[88px] grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 sm:min-h-[92px] sm:grid-cols-[80px_minmax(0,1fr)_auto] md:min-h-[96px] lg:min-h-[100px]">
            <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 sm:h-20 sm:w-20 md:h-[78px] md:w-[78px] lg:h-20 lg:w-20">
              <InventoryImagePreview
                imageUrl={effectiveImage.imageUrl}
                altText={effectiveImage.altText}
                lazy
                className="flex h-full w-full items-center justify-center overflow-hidden bg-white bg-contain bg-center bg-no-repeat p-2 text-sm font-semibold text-slate-900 dark:bg-slate-950 dark:text-white"
                fallback={<span>{buildImageLabel(product.name)}</span>}
              />
            </div>

            <div className="min-w-0 py-0.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-[0.98rem] font-semibold leading-tight text-slate-950 dark:text-white sm:text-[1rem]">
                  {product.name}
                </h3>
                <span
                  className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${getProductStockTone(
                    stock
                  )}`}
                >
                  {stock <= 0
                    ? "Sin stock"
                    : isLowStock(stock)
                      ? `Stock bajo ${stock}`
                      : `Stock ${stock}`}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span className="max-w-full truncate">{product.sku}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-slate-600 dark:text-slate-300">
                  {productSaleTypeLabels[productSaleType]} /{" "}
                  {product.measurementUnit ??
                    (productSaleType === "UNIT" ? "UND" : "KG")}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Precio final
                  </p>
                  <p className="mt-0.5 text-[1.1rem] font-semibold leading-none text-slate-950 dark:text-white">
                    {formattedPrice}
                  </p>
                </div>
                {hasProductInCart ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                    En carrito {quantityInCart}
                  </span>
                ) : null}
                {requiresScale ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${actionTone}`}
                  >
                    {scaleMockEnabled ? (
                      <>
                        <Scale className="h-3.5 w-3.5" />
                        Leer balanza
                      </>
                    ) : (
                      actionLabel
                    )}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end">
              <span
                className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-2xl px-3 text-sm font-bold transition-colors ${actionTone}`}
              >
                {requiresScale ? (
                  scaleMockEnabled ? (
                    <Scale className="h-4 w-4" />
                  ) : (
                    actionLabel
                  )
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </span>
            </div>
          </div>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onAction(product)}
        disabled={isProductActionDisabled}
        className={`group min-h-[200px] overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:bg-slate-800 ${
          hasProductInCart
            ? "border-blue-200 ring-2 ring-blue-100 dark:border-blue-500/40 dark:ring-blue-500/10"
            : "border-slate-200 dark:border-slate-700"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="relative">
            <div className="relative aspect-[4/3] max-h-52 w-full overflow-hidden bg-white xl:max-h-44">
              <InventoryImagePreview
                imageUrl={effectiveImage.imageUrl}
                altText={effectiveImage.altText}
                lazy
                className="flex h-full w-full items-center justify-center overflow-hidden bg-white bg-contain bg-center bg-no-repeat p-2 text-sm font-semibold text-slate-900 dark:bg-slate-950 dark:text-white"
                fallback={<span>{buildImageLabel(product.name)}</span>}
              />
            </div>
            <div className="absolute left-2.5 top-2.5 flex max-w-[calc(100%-1.25rem)] flex-wrap gap-1.5">
              {hasProductInCart ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                  En carrito {quantityInCart}
                </span>
              ) : null}
            </div>
            <div className="absolute right-2.5 top-2.5">
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm ${getProductStockTone(
                  stock
                )}`}
              >
                {stock <= 0
                  ? "Sin stock"
                  : isLowStock(stock)
                    ? `Stock bajo ${stock}`
                    : `Stock ${stock}`}
              </span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-tight text-slate-950 dark:text-white">
                {product.name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span className="max-w-full truncate">{product.sku}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-slate-600 dark:text-slate-300">
                  {productSaleTypeLabels[productSaleType]} /{" "}
                  {product.measurementUnit ??
                    (productSaleType === "UNIT" ? "UND" : "KG")}
                </span>
              </div>
            </div>

            <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-700">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Precio final
                </p>
                <p className="mt-0.5 text-[1.1rem] font-semibold leading-none text-slate-950 dark:text-white">
                  {formattedPrice}
                </p>
              </div>
              <span
                className={`inline-flex h-10 min-w-10 items-center justify-center rounded-2xl px-3 text-sm font-bold transition-colors ${actionTone}`}
              >
                {requiresScale ? (
                  scaleMockEnabled ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Scale className="h-4 w-4" />
                      Leer
                    </span>
                  ) : (
                    actionLabel
                  )
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  }
);

PosProductCard.displayName = "PosProductCard";
