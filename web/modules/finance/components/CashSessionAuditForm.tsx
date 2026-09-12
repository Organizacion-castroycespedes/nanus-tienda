"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Textarea } from "../../../components/design-system/Textarea";
import type { CashSessionSummary, CreateCashSessionAuditPayload } from "../types";
import { formatCurrency } from "../utils";
import { CashSessionBreakdownPanel } from "./CashSessionBreakdownPanel";
import {
  formatCashAmountForInput,
  parseCashAmountInput,
  sanitizeCashAmountInput,
} from "./close-cash-session-money";

type CashSessionAuditFormProps = {
  summary: CashSessionSummary;
  value: CreateCashSessionAuditPayload;
  onChange: (value: CreateCashSessionAuditPayload) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
};

export const CashSessionAuditForm = ({
  summary,
  value,
  onChange,
  onCancel,
  onSubmit,
  isSaving = false,
}: CashSessionAuditFormProps) => {
  const expectedCash = summary.cashControl?.expectedCashAmount ?? summary.totals.expectedAmount;
  const [countedInput, setCountedInput] = useState(() =>
    formatCashAmountForInput(value.countedCashAmount)
  );
  const difference = useMemo(
    () => Number((value.countedCashAmount - expectedCash).toFixed(2)),
    [expectedCash, value.countedCashAmount]
  );

  useEffect(() => {
    const currentAmount = parseCashAmountInput(countedInput);
    if (Math.abs(currentAmount - value.countedCashAmount) > 0.009) {
      setCountedInput(formatCashAmountForInput(value.countedCashAmount));
    }
  }, [countedInput, value.countedCashAmount]);

  const handleCountedChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = sanitizeCashAmountInput(event.target.value);
    setCountedInput(nextValue);
    onChange({
      ...value,
      countedCashAmount: parseCashAmountInput(nextValue),
    });
  };

  return (
    <div className="max-h-[78vh] space-y-4 overflow-y-auto pr-1">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">
            Efectivo esperado
          </p>
          <p className="mt-2 break-words text-xl font-semibold leading-tight text-slate-900 tabular-nums dark:text-white">
            {formatCurrency(expectedCash)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-800 dark:border-slate-700">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Efectivo contado
          </p>
          <div className="mt-2 flex min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:bg-slate-800">
            <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
              $
            </span>
            <input
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none dark:text-white"
              inputMode="decimal"
              value={countedInput}
              onChange={handleCountedChange}
              disabled={isSaving}
            />
          </div>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            difference === 0
              ? "border-emerald-200 bg-emerald-50"
              : difference > 0
                ? "border-blue-200 bg-blue-50"
                : "border-rose-200 bg-rose-50"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">
            Diferencia preliminar
          </p>
          <p className="mt-2 break-words text-xl font-semibold leading-tight text-slate-900 tabular-nums dark:text-white">
            {formatCurrency(difference)}
          </p>
        </div>
      </div>

      <CashSessionBreakdownPanel summary={summary} />

      <Textarea
        label="Observaciones"
        rows={3}
        value={value.notes ?? ""}
        onChange={(event) =>
          onChange({
            ...value,
            notes: event.target.value,
          })
        }
      />

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          Cerrar
        </Button>
        <Button onClick={onSubmit} isLoading={isSaving}>
          Guardar arqueo
        </Button>
      </div>
    </div>
  );
};
