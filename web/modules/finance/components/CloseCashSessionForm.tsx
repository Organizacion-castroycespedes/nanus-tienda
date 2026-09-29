"use client";

import { ChevronDown } from "lucide-react";
import { type ChangeEvent, useEffect, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Textarea } from "../../../components/design-system/Textarea";
import type { CashSessionSummary, CloseCashSessionPayload } from "../types";
import { formatCurrency } from "../utils";
import { CashSessionBreakdownPanel } from "./CashSessionBreakdownPanel";
import {
  formatCashAmountForInput,
  parseCashAmountInput,
  sanitizeCashAmountInput,
} from "./close-cash-session-money";

type CloseCashSessionFormProps = {
  value: CloseCashSessionPayload;
  expectedAmount: number;
  summary?: CashSessionSummary | null;
  onChange: (value: CloseCashSessionPayload) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
};

export const CloseCashSessionForm = ({
  value,
  expectedAmount,
  summary,
  onChange,
  onCancel,
  onSubmit,
  isSaving = false,
}: CloseCashSessionFormProps) => {
  const [closingAmountInput, setClosingAmountInput] = useState(() =>
    value.closingAmount === 0 ? "" : formatCashAmountForInput(value.closingAmount)
  );
  const [paymentSummaryExpanded, setPaymentSummaryExpanded] = useState(false);
  const differenceAmount = Number((value.closingAmount - expectedAmount).toFixed(2));

  useEffect(() => {
    const currentAmount = parseCashAmountInput(closingAmountInput);
    if (Math.abs(currentAmount - value.closingAmount) > 0.009) {
      setClosingAmountInput(formatCashAmountForInput(value.closingAmount));
    }
  }, [closingAmountInput, value.closingAmount]);

  const handleClosingAmountChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = sanitizeCashAmountInput(event.target.value);
    setClosingAmountInput(nextValue);
    onChange({
      ...value,
      closingAmount: parseCashAmountInput(nextValue),
    });
  };

  return (
    <div className="flex max-h-[calc(100dvh-8rem)] min-h-0 flex-col overflow-hidden sm:max-h-[calc(100dvh-10rem)]">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Efectivo esperado
            </p>
            <p className="mt-1 break-words text-lg font-semibold leading-tight text-slate-900 tabular-nums sm:text-xl dark:text-white">
              {formatCurrency(expectedAmount)}
            </p>
          </div>
          <label className="min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              Efectivo contado <span className="text-rose-600">*</span>
            </span>
            <div className="mt-1.5 flex min-w-0 overflow-hidden rounded-lg border border-blue-300 bg-white shadow-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 dark:bg-slate-800">
              <span className="flex items-center border-r border-blue-200 bg-blue-50 px-2.5 text-sm font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                $
              </span>
              <input
                className="min-w-0 flex-1 border-0 bg-transparent px-2.5 py-1.5 text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:text-white"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]{0,2}"
                placeholder="0"
                value={closingAmountInput}
                onChange={handleClosingAmountChange}
                disabled={isSaving}
                required
                aria-label="Efectivo contado"
              />
            </div>
          </label>
          <div
            className={`min-w-0 rounded-xl border p-3 ${
              differenceAmount === 0
                ? "border-emerald-200 bg-emerald-50"
                : differenceAmount > 0
                  ? "border-blue-200 bg-blue-50"
                  : "border-rose-200 bg-rose-50"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
              Diferencia
            </p>
            <p className="mt-1 break-words text-lg font-semibold leading-tight text-slate-900 tabular-nums sm:text-xl dark:text-white">
              {formatCurrency(differenceAmount)}
            </p>
          </div>
        </div>

        {summary ? (
          <CashSessionBreakdownPanel
            summary={summary}
            compact
            collapsiblePaymentMethods
            paymentSummaryExpanded={paymentSummaryExpanded}
            onPaymentSummaryExpandedChange={setPaymentSummaryExpanded}
          />
        ) : null}

        <div className="grid gap-3">
          <Textarea
            label="Observacion"
            rows={2}
            value={value.description ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                description: event.target.value,
              })
            }
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white pt-3 sm:flex-row sm:justify-end dark:bg-slate-800 dark:border-slate-700">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="warning" onClick={onSubmit} isLoading={isSaving}>
          Entregar mi cierre
        </Button>
      </div>
    </div>
  );
};
