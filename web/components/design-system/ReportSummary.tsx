import React, { type ReactNode } from "react";

export type ReportSummaryItem = {
  label: string;
  value: ReactNode;
  ariaLabel?: string;
  /** Texto de ayuda nativo (tooltip) del segmento. */
  title?: string;
  /** Línea secundaria bajo el valor (p. ej. alcance o desglose). */
  detail?: ReactNode;
  /** Título nativo de la línea secundaria, útil cuando se trunca. */
  detailTitle?: string;
};

export type ReportSummaryColumns = 4 | 6;

type ReportSummaryProps = {
  items: ReportSummaryItem[];
  /** Columnas en escritorio. 4 (por defecto) o 6. */
  columns?: ReportSummaryColumns;
  ariaLabel?: string;
};

// Clases literales para que Tailwind las incluya en el build.
const columnClasses: Record<ReportSummaryColumns, string> = {
  4: "grid-cols-2 md:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6",
};

/** Compact report metrics band. Keeps data visible without pushing the table down. */
export const ReportSummary = ({ items, columns = 4, ariaLabel = "Resumen del reporte" }: ReportSummaryProps) => (
  <section
    aria-label={ariaLabel}
    className={`grid ${columnClasses[columns]} gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-700`}
  >
    {items.map((item) => (
      <div
        key={item.label}
        className="min-h-[70px] min-w-0 bg-white px-3 py-3 dark:bg-slate-800"
        aria-label={item.ariaLabel}
        title={item.title}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
        <p className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-white">{item.value}</p>
        {item.detail ? (
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400" title={item.detailTitle}>
            {item.detail}
          </p>
        ) : null}
      </div>
    ))}
  </section>
);
