import React, { type ReactNode } from "react";

type ReportLayoutProps = {
  title: string;
  description?: string;
  toolbar?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
};

/** Shared report shell. Existing reports can adopt slots gradually. */
export const ReportLayout = ({
  title,
  description,
  toolbar,
  summary,
  children,
}: ReportLayoutProps) => (
  <div className="space-y-4">
    <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
      {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
    </header>
    {toolbar ? <section>{toolbar}</section> : null}
    {summary ? <section>{summary}</section> : null}
    <section>{children}</section>
  </div>
);
