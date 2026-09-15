"use client";

import { Check } from "lucide-react";

type Props = {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export const PaymentMethodSelector = ({ options, value, onChange, disabled }: Props) => (
  <div role="group" aria-label="Método de pago" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {options.map((option) => {
      const label = option.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let icon = "💲";
      if (label.includes("efectivo") || label.includes("cash")) icon = "💵";
      else if (label.includes("debito") || label.includes("debit") || label.includes("credito") || label.includes("credit")) icon = "💳";
      else if (label.includes("transferencia") || label.includes("transfer")) icon = "🏦";
      else if (label.includes("nequi") || label.includes("daviplata") || label.includes("app")) icon = "📱";
      const selected = value === option.value;
      return (
        <button key={option.value} type="button" disabled={disabled} aria-pressed={selected}
          onClick={() => onChange(option.value)} title={option.label}
          className={`flex min-h-[48px] min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-center transition-all disabled:cursor-not-allowed disabled:opacity-60 ${selected
            ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"}`}>
          <span aria-hidden="true" className="shrink-0 text-xl">{icon}</span>
          <span className="truncate text-sm font-medium leading-tight">{option.label}</span>
          {selected ? <Check aria-hidden="true" className="h-3 w-3 shrink-0" /> : null}
        </button>
      );
    })}
  </div>
);
