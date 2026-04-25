"use client";

import type { ReactNode } from "react";

export type ToastVariant = "success" | "error" | "warning";

type ToastProps = {
  message: ReactNode;
  variant?: ToastVariant;
  onClose?: () => void;
};

const variantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

const dotStyles: Record<ToastVariant, string> = {
  success: "bg-emerald-500",
  error: "bg-rose-500",
  warning: "bg-amber-500",
};

export const Toast = ({ message, variant = "success", onClose }: ToastProps) => (
  <div
    role="status"
    aria-live="polite"
    className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${variantStyles[variant]}`}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1 h-2.5 w-2.5 rounded-full ${dotStyles[variant]}`}
          aria-hidden="true"
        />
        <span className="font-medium">{message}</span>
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold uppercase tracking-wide text-inherit/70 hover:text-inherit"
        >
          Cerrar
        </button>
      ) : null}
    </div>
  </div>
);
