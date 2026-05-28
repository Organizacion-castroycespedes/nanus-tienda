"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "../../../components/design-system/Button";

type PurchaseActionHeaderProps = {
  title: string;
  subtitle: string;
  purchaseCode?: string | null;
  status?: string | null;
  onBack: () => void;
};

export const PurchaseActionHeader = ({
  title,
  subtitle,
  purchaseCode,
  status,
  onBack,
}: PurchaseActionHeaderProps) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-slate-500">Compras</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
        {purchaseCode || status ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide">
            {purchaseCode ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                Compra {purchaseCode}
              </span>
            ) : null}
            {status ? (
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-blue-700">
                Estado {status}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </Button>
    </div>
  </section>
);
