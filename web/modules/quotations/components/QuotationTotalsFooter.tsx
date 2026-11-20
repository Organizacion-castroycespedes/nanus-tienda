"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { formatQuotationMoney } from "../quotation-format";
import type { QuotationTotals } from "./QuotationSummaryCard";

/** Totales fijos bajo la tabla, colapsables (portado de QuotationExcelFooter de flexibuild). */
export const QuotationTotalsFooter = ({ totals }: { totals: QuotationTotals }) => {
  const [collapsed, setCollapsed] = useState(false);
  const rows: Array<[string, number]> = [
    ["Subtotal general", totals.subtotal],
    ...totals.taxes.map((tax): [string, number] => [`${tax.taxName} ${tax.taxRate}%`, tax.taxAmount]),
  ];
  if (totals.taxes.length === 0) {
    rows.push(["Impuestos", totals.taxTotal]);
  }

  if (collapsed) {
    return (
      <div className="sticky bottom-0 z-10 ml-auto flex w-full max-w-xl justify-end">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex items-center gap-2 border border-slate-400 bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800"
        >
          <ChevronUp className="h-4 w-4" />
          Mostrar totales
        </button>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 z-10 ml-auto w-full max-w-xl border border-slate-400 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <div className="flex items-center justify-between border-b border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Totales</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="inline-flex items-center gap-1 border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <ChevronDown className="h-4 w-4" />
          Ocultar
        </button>
      </div>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-slate-200 dark:border-slate-700">
              <td className="bg-slate-100 px-3 py-2 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-300">{label}</td>
              <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">{formatQuotationMoney(value)}</td>
            </tr>
          ))}
          <tr className="bg-slate-900 text-white">
            <td className="px-3 py-3 text-base font-bold uppercase">Total final</td>
            <td className="px-3 py-3 text-right text-base font-bold">{formatQuotationMoney(totals.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
