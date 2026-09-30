import type { ReactNode } from "react";

type FinancePageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  compact?: boolean;
};

export const FinancePageHeader = ({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
}: FinancePageHeaderProps) => {
  const content = (
    <>
      <p
        className={
          compact
            ? "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
            : "text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400"
        }
      >
        {eyebrow}
      </p>
      <h1
        className={
          compact
            ? "text-2xl font-bold text-slate-950 dark:text-white"
            : "mt-2 text-3xl font-semibold text-slate-900 dark:text-white"
        }
      >
        {title}
      </h1>
      <p
        className={
          compact
            ? "text-sm text-slate-500 dark:text-slate-400"
            : "mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
        }
      >
        {description}
      </p>
    </>
  );

  const actionContent = actions ? (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "flex flex-wrap gap-3"}>
      {actions}
    </div>
  ) : null;

  return (
    <section
      className={
        compact
          ? "flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700"
          : "rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-sm"
      }
    >
      {compact ? (
        <>
          <div className="min-w-0">{content}</div>
          {actionContent}
        </>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">{content}</div>
          {actionContent}
        </div>
      )}
    </section>
  );
};
