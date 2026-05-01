import type { ReactNode } from "react";

type FinancePageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export const FinancePageHeader = ({
  eyebrow,
  title,
  description,
  actions,
}: FinancePageHeaderProps) => (
  <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  </section>
);
