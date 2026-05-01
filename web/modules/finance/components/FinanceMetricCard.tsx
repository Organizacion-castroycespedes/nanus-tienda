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
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accentStyles[accent]}`}
    >
      {label}
    </span>
    <p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p>
    {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
  </article>
);
