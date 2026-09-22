import type { ReactNode } from "react";

type ProductSectionCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export const ProductSectionCard = ({
  title,
  description,
  icon,
  children,
  className = "",
}: ProductSectionCardProps) => (
  <section
    className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}
  >
    <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700">
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
      </div>
    </div>
    <div className="p-6">{children}</div>
  </section>
);
