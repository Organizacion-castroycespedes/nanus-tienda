"use client";

import {
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Scale,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import { Modal } from "../../../../components/design-system/Modal";
import { InventoryImagePreview } from "../../../inventory/components/InventoryImagePreview";
import type { PosCartAppliedTax, PosCartItem } from "../../../../store/posCart";
import { buildPosCartDiscountDisplay } from "../pos-discount-display";

export type CartSaleLineItem = PosCartItem & {
  unitPrice: number;
  subtotal: number;
  taxes: PosCartAppliedTax[];
  taxTotal: number;
  discountTotal: number;
};

export type CartSaleSummary = {
  subtotal: number;
  taxesTotal: number;
  discountTotal: number;
  total: number;
  taxBreakdown: Array<[string, number]>;
};

export type CartSaleItemPresentation = {
  imageUrl: string | null;
  imageAlt: string;
  imageLabel: string;
  saleTypeLabel: string;
  unitLabel: string;
  isWeighable: boolean;
};

type CartSaleModalProps = {
  open: boolean;
  items: CartSaleLineItem[];
  summary: CartSaleSummary;
  expandedTaxItems: Record<string, boolean>;
  canCharge: boolean;
  hasPricingPending: boolean;
  pricingErrorMessage: string | null;
  scaleMockEnabled: boolean;
  scaleReading: boolean;
  resolvePresentation: (item: CartSaleLineItem) => CartSaleItemPresentation;
  formatCurrency: (value: number) => string;
  parseQuantityInput: (value: string) => number;
  onClose: () => void;
  onCancelSale: () => void;
  onCharge: () => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onToggleTaxBreakdown: (productId: string) => void;
  onToggleSummaryTaxes: () => void;
  summaryTaxesExpanded: boolean;
  onReadScale: (productId: string) => void;
};

export const CartSaleModal = ({
  open,
  items,
  summary,
  expandedTaxItems,
  canCharge,
  hasPricingPending,
  pricingErrorMessage,
  scaleMockEnabled,
  scaleReading,
  resolvePresentation,
  formatCurrency,
  parseQuantityInput,
  onClose,
  onCancelSale,
  onCharge,
  onUpdateQuantity,
  onRemoveItem,
  onToggleTaxBreakdown,
  onToggleSummaryTaxes,
  summaryTaxesExpanded,
  onReadScale,
}: CartSaleModalProps) => {
  if (!open) {
    return null;
  }

  const itemCountLabel = items.length === 1 ? "1 ítem" : `${items.length} ítems`;
  const netSubtotal = Math.max(summary.subtotal - summary.taxesTotal, 0);

  return (
    <Modal
      size="full"
      responsive
      fullScreen
      onClose={onClose}
      className="dark:bg-slate-950"
      bodyClassName="!overflow-hidden !pr-0 flex min-h-0 flex-1 flex-col"
      footerClassName="!mt-0 w-full flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between"
      header={
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
              Carrito de venta
            </h3>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Revisa productos, totales y cobra sin perder contexto.
            </p>
          </div>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onCancelSale}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
          >
            <X className="h-4 w-4" />
            Cancelar venta
          </button>
          <Button
            className="min-h-12 rounded-xl text-base font-bold shadow-lg transition-all hover:shadow-xl active:scale-[0.98] sm:min-w-[16rem] sm:flex-1 md:flex-none md:min-w-[20rem]"
            size="lg"
            onClick={onCharge}
            disabled={!canCharge}
          >
            <Wallet className="h-4 w-4" />
            COBRAR {formatCurrency(summary.total)}
            <kbd className="ml-1 hidden rounded-md border border-white/30 bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white sm:inline">
              F12
            </kbd>
          </Button>
        </>
      }
    >
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white sm:text-lg">
                Venta actual
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Productos en el carrito
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              {itemCountLabel}
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <ShoppingCart className="h-8 w-8 text-slate-300 dark:text-slate-500" />
                <p className="mt-3 text-base font-semibold text-slate-700 dark:text-slate-100">
                  Tu carrito esta vacio
                </p>
                <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Agrega productos para iniciar una venta.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const presentation = resolvePresentation(item);
                  const discountDisplay = buildPosCartDiscountDisplay({
                    baseUnitPrice: item.baseUnitPrice,
                    finalUnitPrice: item.finalUnitPrice,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    discountAmount: item.discountAmount,
                    discountTotal: item.discountTotal,
                    discountPercent: item.discountPercent,
                    isWeighable: presentation.isWeighable,
                  });

                  return (
                    <article
                      key={item.productId}
                      className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/80 sm:p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 sm:h-16 sm:w-16">
                          <InventoryImagePreview
                            imageUrl={presentation.imageUrl}
                            altText={presentation.imageAlt}
                            lazy
                            className="flex h-full w-full items-center justify-center overflow-hidden bg-white bg-contain bg-center bg-no-repeat p-1.5 text-[10px] font-semibold text-slate-900 dark:bg-slate-950 dark:text-white"
                            fallback={<span>{presentation.imageLabel}</span>}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="line-clamp-2 text-sm font-semibold uppercase leading-tight text-slate-950 dark:text-white">
                                {item.name}
                              </h3>
                              <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {item.sku} • {presentation.saleTypeLabel} / {presentation.unitLabel}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.productId)}
                              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                              aria-label={`Eliminar ${item.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="space-y-1.5">
                              <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateQuantity(item.productId, item.quantity - 1)
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-50 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-900"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <input
                                  value={item.quantity}
                                  onChange={(event) =>
                                    onUpdateQuantity(
                                      item.productId,
                                      parseQuantityInput(event.target.value)
                                    )
                                  }
                                  className="w-12 border-x border-slate-200 bg-transparent px-1 py-1.5 text-center text-sm font-semibold text-slate-900 focus:outline-none dark:border-slate-700 dark:text-white"
                                  inputMode={presentation.isWeighable ? "decimal" : "numeric"}
                                  aria-label={`Cantidad de ${item.name}`}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateQuantity(item.productId, item.quantity + 1)
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-50 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-900"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>

                              {presentation.isWeighable ? (
                                <button
                                  type="button"
                                  onClick={() => onReadScale(item.productId)}
                                  disabled={!scaleMockEnabled || scaleReading}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 text-[11px] font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20"
                                >
                                  {scaleReading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Scale className="h-3.5 w-3.5" />
                                  )}
                                  Leer balanza
                                </button>
                              ) : null}

                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Stock disponible: {item.stock}
                              </p>
                            </div>

                            <div className="text-left sm:text-right">
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Precio unitario{" "}
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {formatCurrency(item.unitPrice)}
                                </span>
                              </p>
                              <p className="mt-1 text-base font-bold text-slate-950 dark:text-white">
                                Total {formatCurrency(item.subtotal)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                            {item.pricingStatus === "PENDING" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {item.pricingError === "Precio pendiente de actualización"
                                  ? "Precio pendiente de actualización"
                                  : "Calculando precio"}
                              </span>
                            ) : null}

                            {item.pricingStatus === "ERROR" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                                Error: {item.pricingError}
                              </span>
                            ) : null}

                            {item.appliedPromotionName ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                                Promo: {item.appliedPromotionName}
                              </span>
                            ) : null}

                            {discountDisplay ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                                Ahorro {formatCurrency(discountDisplay.totalDiscount)}
                              </span>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => onToggleTaxBreakdown(item.productId)}
                            className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                          >
                            <span>Impuestos {formatCurrency(item.taxTotal)}</span>
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                expandedTaxItems[item.productId] ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {expandedTaxItems[item.productId] ? (
                            <div className="mt-2 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] dark:border-slate-700 dark:bg-slate-950/80">
                              {item.taxes.length === 0 ? (
                                <p className="text-slate-500 dark:text-slate-400">
                                  Este producto no tiene impuestos asociados.
                                </p>
                              ) : (
                                item.taxes.map((tax) => (
                                  <div
                                    key={tax.taxId}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <span className="truncate text-slate-700 dark:text-slate-200">
                                      {tax.taxName}
                                    </span>
                                    <span className="shrink-0 text-slate-600 dark:text-slate-300">
                                      {formatCurrency(tax.taxAmount)}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/60 sm:p-4 md:overflow-y-auto">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <ShoppingBag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Resumen de pago
          </div>

          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Subtotal</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {formatCurrency(netSubtotal)}
              </span>
            </div>

            <div>
              <button
                type="button"
                onClick={onToggleSummaryTaxes}
                className="flex w-full items-center justify-between text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <span className="inline-flex items-center gap-1.5">
                  Impuestos
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      summaryTaxesExpanded ? "rotate-180" : ""
                    }`}
                  />
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatCurrency(summary.taxesTotal)}
                </span>
              </button>
              {summaryTaxesExpanded ? (
                <div className="mt-2 space-y-1.5 border-l border-slate-200 pl-3 dark:border-slate-700">
                  {summary.taxBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Sin impuestos</p>
                  ) : (
                    summary.taxBreakdown.map(([taxName, amount]) => (
                      <div
                        key={taxName}
                        className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"
                      >
                        <span className="truncate">{taxName}</span>
                        <span className="shrink-0">{formatCurrency(amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Descuentos</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {formatCurrency(summary.discountTotal)}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/90 p-3 dark:border-blue-900/50 dark:bg-blue-950/40 sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
              Total a cobrar
            </p>
            <p className="mt-1 text-2xl font-black leading-tight text-blue-950 dark:text-white sm:text-3xl">
              {formatCurrency(summary.total)}
            </p>
          </div>

          {hasPricingPending ? (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
              Calculando precio/promocion antes de cobrar.
            </div>
          ) : null}

          {pricingErrorMessage ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
              {pricingErrorMessage}
            </div>
          ) : null}
        </aside>
      </div>
    </Modal>
  );
};
