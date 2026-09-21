import React, { useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "./Button";

export type ReportFilterDefinition = {
  key: string;
  label: string;
  priority: "primary" | "secondary";
  active: boolean;
  activeLabel?: string;
  render: () => ReactNode;
  clear: () => void;
};

type ReportFiltersProps = {
  filters: ReportFilterDefinition[];
  actions?: ReactNode;
};

export const getActiveReportFilters = (filters: ReportFilterDefinition[]) =>
  filters.filter((filter) => filter.priority === "secondary" && filter.active);

export const ReportFilters = ({ filters, actions }: ReportFiltersProps) => {
  const [open, setOpen] = useState(false);
  const primaryFilters = filters.filter((filter) => filter.priority === "primary");
  const secondaryFilters = filters.filter((filter) => filter.priority === "secondary");
  const activeFilters = getActiveReportFilters(filters);

  return (
    <>
      <div className="relative">
        <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 basis-[280px]">{primaryFilters.map((filter) => <div key={filter.key}>{filter.render()}</div>)}</div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {actions}
              <Button type="button" variant="outline" size="sm" aria-expanded={open} aria-controls="report-secondary-filters" onClick={() => setOpen((value) => !value)}>
                <SlidersHorizontal className="h-4 w-4" /> Filtros{activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}
              </Button>
            </div>
          </div>
        </section>
        {open ? (
          <div id="report-secondary-filters" role="dialog" aria-label="Filtros secundarios del reporte" className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-800 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:bottom-auto sm:mt-2 sm:w-[min(92vw,440px)] sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Filtros secundarios</h2>
              <Button type="button" variant="ghost" size="sm" aria-label="Cerrar filtros secundarios" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {secondaryFilters.map((filter) => <div key={filter.key}>{filter.render()}</div>)}
            </div>
            {activeFilters.length > 0 ? <div className="mt-3 flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={() => activeFilters.forEach((filter) => filter.clear())}>Limpiar filtros</Button></div> : null}
          </div>
        ) : null}
      </div>
      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros activos">
          {activeFilters.map((filter) => <span key={filter.key} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            {filter.label}: {filter.activeLabel}
            <button type="button" className="rounded-full p-0.5 hover:bg-blue-100" aria-label={`Limpiar ${filter.label}`} onClick={filter.clear}><X className="h-3 w-3" /></button>
          </span>)}
        </div>
      ) : null}
    </>
  );
};
