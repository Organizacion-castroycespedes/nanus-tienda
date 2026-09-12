import type { ReactNode } from "react";

type FinanceMetricCardProps = {
  label: string;
  value: ReactNode;
  accent?: "amber" | "emerald" | "slate" | "rose" | "blue";
  helper?: string;
};

const accentStyles = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
} as const;

export const FinanceMetricCard = ({
  label,
  value,
  accent = "slate",
  helper,
}: FinanceMetricCardProps) => (
  <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:bg-slate-800 dark:border-slate-700">
    <span
      className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase leading-tight tracking-[0.14em] whitespace-normal break-words ${accentStyles[accent]}`}
    >
      {label}
    </span>
    <div className="mt-4 min-w-0 whitespace-normal break-words text-xl font-semibold leading-tight text-slate-900 tabular-nums sm:text-2xl dark:text-white">
      {value}
    </div>
    {helper ? (
      <p className="mt-2 min-w-0 whitespace-normal break-words text-sm leading-snug text-slate-500 dark:text-slate-400">
        {helper}
      </p>
    ) : null}
  </article>
);
