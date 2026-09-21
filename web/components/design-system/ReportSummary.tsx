import React, { type ReactNode } from "react";

export type ReportSummaryItem = {
  label: string;
  value: ReactNode;
  ariaLabel?: string;
};

type ReportSummaryProps = {
  items: ReportSummaryItem[];
};

/** Compact report metrics band. Keeps data visible without pushing the table down. */
export const ReportSummary = ({ items }: ReportSummaryProps) => (
  <section
    aria-label="Resumen del reporte"
    className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-700 md:grid-cols-4"
  >
    {items.map((item) => (
      <div key={item.label} className="min-h-[70px] bg-white px-3 py-3 dark:bg-slate-800" aria-label={item.ariaLabel}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
        <p className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-white">{item.value}</p>
      </div>
    ))}
  </section>
);
