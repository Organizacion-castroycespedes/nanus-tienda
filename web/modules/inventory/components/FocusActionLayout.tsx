"use client";

import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/design-system/Button";

type FocusActionLayoutProps = {
  title: string;
  description: string;
  contextLabel?: string;
  onBack: () => void;
  onCancel?: () => void;
  children: ReactNode;
};

export const FocusActionLayout = ({
  title,
  description,
  contextLabel,
  onBack,
  onCancel,
  children,
}: FocusActionLayoutProps) => (
  <section className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500">Accion activa</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          {contextLabel ? (
            <span className="mt-4 inline-flex max-w-full rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-blue-700">
              <span className="truncate">{contextLabel}</span>
            </span>
          ) : null}
        </div>
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} className="w-full sm:w-auto">
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          ) : null}
          <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </div>
      </div>
    </div>

    <div className="mx-auto w-full max-w-6xl">{children}</div>
  </section>
);
