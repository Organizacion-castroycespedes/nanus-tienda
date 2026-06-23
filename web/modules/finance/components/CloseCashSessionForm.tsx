"use client";

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
    formatCashAmountForInput(value.closingAmount)
  );
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
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-amber-700">
              Efectivo esperado
            </p>
            <p className="mt-2 break-words text-xl font-semibold leading-tight text-slate-900 tabular-nums sm:text-2xl">
              {formatCurrency(expectedAmount)}
            </p>
          </div>
          <div
            className={`min-w-0 rounded-2xl border p-4 ${
              differenceAmount === 0
                ? "border-emerald-200 bg-emerald-50"
                : differenceAmount > 0
                  ? "border-blue-200 bg-blue-50"
                  : "border-rose-200 bg-rose-50"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.25em] text-slate-600">
              Diferencia
            </p>
            <p className="mt-2 break-words text-xl font-semibold leading-tight text-slate-900 tabular-nums sm:text-2xl">
              {formatCurrency(differenceAmount)}
            </p>
          </div>
        </div>

        {summary ? (
          <CashSessionBreakdownPanel summary={summary} />
        ) : null}

        <div className="grid gap-4">
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            <span className="font-medium">
              Efectivo contado <span className="text-rose-600">*</span>
            </span>
            <div className="flex min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100">
              <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                $
              </span>
              <input
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]{0,2}"
                placeholder="0.00"
                value={closingAmountInput}
                onChange={handleClosingAmountChange}
                disabled={isSaving}
                required
              />
            </div>
          </label>
          <Textarea
            label="Observacion"
            rows={3}
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

      <div className="mt-4 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="warning" onClick={onSubmit} isLoading={isSaving}>
          Cerrar caja
        </Button>
      </div>
    </div>
  );
};
