"use client";

import { ScanBarcode } from "lucide-react";
import type { ReactNode } from "react";

import type { InventoryScanFeedback, InventoryScanTone } from "./inventory-scan-feedback";
import type { InventoryBarcodeCapture } from "./use-inventory-barcode-capture";

type InventoryScanBarProps = {
  id: string;
  capture: InventoryBarcodeCapture;
  label?: string;
  placeholder?: string;
  feedback?: InventoryScanFeedback | null;
  disabled?: boolean;
  /** Resultados de búsqueda manual u otro contenido bajo la barra. */
  children?: ReactNode;
};

const toneClasses: Record<InventoryScanTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
  error: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100",
};

export const InventoryScanBar = ({
  id,
  capture,
  label = "Escanear o buscar producto",
  placeholder = "Escanea un código o escribe nombre, SKU o código",
  feedback,
  disabled = false,
  children,
}: InventoryScanBarProps) => {
  const statusId = `${id}-status`;
  const isAssertive = feedback?.tone === "error" || feedback?.tone === "warning";
  const statusLabel = disabled
    ? "Lector inactivo"
    : capture.isFocused
      ? "Lector listo"
      : "F2 para escanear";
  const statusTone = disabled
    ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
    : capture.isFocused
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100"
      : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100";

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <div className="relative">
        <ScanBarcode
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
        />
        <input
          id={id}
          ref={capture.inputRef}
          type="text"
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={statusId}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-32 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          {...capture.inputProps}
        />
        <span
          id={statusId}
          className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone}`}
        >
          {statusLabel}
        </span>
      </div>
      <div aria-live="polite" className="sr-only">
        {feedback && !isAssertive ? <span key={feedback.at}>{feedback.message}</span> : null}
      </div>
      <div aria-live="assertive" className="sr-only">
        {feedback && isAssertive ? <span key={feedback.at}>{feedback.message}</span> : null}
      </div>
      {feedback ? (
        <p
          key={feedback.at}
          className={`rounded-lg border px-3 py-2 text-sm ${toneClasses[feedback.tone]}`}
        >
          {feedback.message}
        </p>
      ) : null}
      {children}
    </div>
  );
};
