"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "./Button";

export type ConfirmationMessageProps = {
  title: string;
  description?: string;
  onDismiss?: () => void;
};

export const ConfirmationMessage = ({
  title,
  description,
  onDismiss,
}: ConfirmationMessageProps) => {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-white text-emerald-700">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-emerald-950">{title}</h2>
            {description ? (
              <p className="text-sm leading-6 text-emerald-900/80">{description}</p>
            ) : null}
          </div>
        </div>

        {onDismiss ? (
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Cerrar
          </Button>
        ) : null}
      </div>
    </section>
  );
};
