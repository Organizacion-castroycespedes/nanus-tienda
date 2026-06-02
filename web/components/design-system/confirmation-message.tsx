"use client";

import { AlertTriangle, Info, ShieldCheck, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export type ConfirmationMessageProps = {
  title: string;
  description?: string;
  variant?: "success" | "warning" | "danger" | "info";
  actions?: ReactNode;
  onDismiss?: () => void;
};

export const ConfirmationMessage = ({
  title,
  description,
  variant = "success",
  actions,
  onDismiss,
}: ConfirmationMessageProps) => {
  const config = {
    success: {
      section: "border-emerald-200 bg-emerald-50",
      iconWrap: "border-emerald-100 bg-white text-emerald-700",
      title: "text-emerald-950",
      description: "text-emerald-900/80",
      icon: ShieldCheck,
    },
    warning: {
      section: "border-amber-200 bg-amber-50",
      iconWrap: "border-amber-100 bg-white text-amber-700",
      title: "text-amber-950",
      description: "text-amber-900/80",
      icon: AlertTriangle,
    },
    danger: {
      section: "border-rose-200 bg-rose-50",
      iconWrap: "border-rose-100 bg-white text-rose-700",
      title: "text-rose-950",
      description: "text-rose-900/80",
      icon: XCircle,
    },
    info: {
      section: "border-blue-200 bg-blue-50",
      iconWrap: "border-blue-100 bg-white text-blue-700",
      title: "text-blue-950",
      description: "text-blue-900/80",
      icon: Info,
    },
  }[variant];
  const Icon = config.icon;

  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${config.section}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${config.iconWrap}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className={`text-base font-semibold ${config.title}`}>{title}</h2>
            {description ? (
              <p className={`text-sm leading-6 ${config.description}`}>{description}</p>
            ) : null}
          </div>
        </div>

        {actions || onDismiss ? (
          <div className="flex flex-wrap gap-2">
            {actions}
            {onDismiss ? (
              <Button variant="outline" size="sm" onClick={onDismiss}>
                Cerrar
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
};
