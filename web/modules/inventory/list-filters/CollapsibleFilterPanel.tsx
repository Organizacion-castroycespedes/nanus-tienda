"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  formatListFiltersTitle,
  readFiltersPanelOpen,
  writeFiltersPanelOpen,
} from "./list-filters";

type CollapsibleFilterPanelProps = {
  id: string;
  /** Clave de la preferencia mostrar/ocultar (por módulo). */
  storageKey: string;
  activeCount: number;
  children: ReactNode;
};

/**
 * Panel de filtros oculto por defecto que recuerda la última elección del
 * usuario. El contenido siempre está montado (se oculta con `hidden`) para
 * conservar lo escrito en los campos.
 */
export const CollapsibleFilterPanel = ({
  id,
  storageKey,
  activeCount,
  children,
}: CollapsibleFilterPanelProps) => {
  const [open, setOpen] = useState(false);
  const contentId = `${id}-content`;

  useEffect(() => {
    setOpen(readFiltersPanelOpen(storageKey));
  }, [storageKey]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      writeFiltersPanelOpen(storageKey, next);
      return next;
    });
  };

  return (
    <section
      id={id}
      aria-label="Filtros"
      className="w-full max-w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800 dark:border-slate-700"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
          {formatListFiltersTitle(activeCount)}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={toggle}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {open ? "Ocultar filtros" : "Mostrar filtros"}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>
      <div id={contentId} hidden={!open} className="mt-4">
        {children}
      </div>
    </section>
  );
};
