"use client";

import { formatQuotationDate, formatQuotationMoney } from "../quotation-format";
import type { QuotationTaxSummary } from "../types";

export type QuotationTotals = {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  taxes: QuotationTaxSummary[];
  /** true mientras alguna linea usa el precio de lista (sin respuesta del motor). */
  estimated: boolean;
};

type Props = {
  totals: QuotationTotals;
  issueDate: string;
  validUntil: string;
  validityDays: number;
  /** Texto del estado de guardado o de la fuente de los valores. */
  statusLabel: string;
};

/** Resumen financiero fijo (portado de flexibuild: bloque oscuro de "Total final"). */
export const QuotationSummaryCard = ({ totals, issueDate, validUntil, validityDays, statusLabel }: Props) => (
  <article className="sticky top-4 border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Resumen financiero</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">IVA por producto</h2>
      </div>
      <span className="border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
        {statusLabel}
      </span>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-2 border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
      <span className="text-slate-600 dark:text-slate-400">Emisión</span>
      <strong className="text-right font-semibold text-slate-900 dark:text-white">{formatQuotationDate(issueDate)}</strong>
      <span className="text-slate-600 dark:text-slate-400">Válida hasta</span>
      <strong className="text-right font-semibold text-slate-900 dark:text-white">
        {formatQuotationDate(validUntil)} ({validityDays} d)
      </strong>
    </div>

    <div className="mt-3 divide-y divide-slate-200 border border-slate-300 dark:divide-slate-700 dark:border-slate-600">
      <div className="flex items-center justify-between gap-3 bg-white px-3 py-3 dark:bg-slate-800">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Subtotal</span>
        <strong className="text-sm font-semibold text-slate-900 dark:text-white">{formatQuotationMoney(totals.subtotal)}</strong>
      </div>
      {totals.taxes.length > 0 ? (
        totals.taxes.map((tax) => (
          <div key={`${tax.taxName}-${tax.taxRate}`} className="flex items-center justify-between gap-3 bg-white px-3 py-3 dark:bg-slate-800">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {tax.taxName} ({tax.taxRate}%)
            </span>
            <strong className="text-sm font-semibold text-slate-900 dark:text-white">{formatQuotationMoney(tax.taxAmount)}</strong>
          </div>
        ))
      ) : (
        <div className="flex items-center justify-between gap-3 bg-white px-3 py-3 dark:bg-slate-800">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Impuestos</span>
          <strong className="text-sm font-semibold text-slate-900 dark:text-white">{formatQuotationMoney(totals.taxTotal)}</strong>
        </div>
      )}
      {totals.discountTotal > 0 ? (
        <div className="flex items-center justify-between gap-3 bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10">
          <span className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Ahorro por promociones (incluido)</span>
          <strong className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">{formatQuotationMoney(totals.discountTotal)}</strong>
        </div>
      ) : null}
    </div>

    <div className="mt-4 border border-slate-900 bg-slate-900 px-4 py-4 text-white dark:border-slate-950 dark:bg-slate-950">
      <p className="text-xs uppercase tracking-wide text-slate-200">Total final</p>
      <p className="mt-1 text-2xl font-semibold text-white">{formatQuotationMoney(totals.total)}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-200">
        <span>Subtotal base</span>
        <strong className="text-right">{formatQuotationMoney(totals.subtotal)}</strong>
        <span>Impuestos</span>
        <strong className="text-right">{formatQuotationMoney(totals.taxTotal)}</strong>
      </div>
      {totals.estimated ? (
        <p className="mt-3 text-xs text-amber-200">Valores estimados con precio de lista; al guardar se recalculan.</p>
      ) : null}
    </div>
  </article>
);
