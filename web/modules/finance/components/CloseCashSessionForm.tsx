"use client";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Textarea } from "../../../components/design-system/Textarea";
import type { CashSessionSummary, CloseCashSessionPayload } from "../types";
import { formatCurrency } from "../utils";

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
  const differenceAmount = Number((value.closingAmount - expectedAmount).toFixed(2));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-700">Esperado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(expectedAmount)}
          </p>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            differenceAmount === 0
              ? "border-emerald-200 bg-emerald-50"
              : differenceAmount > 0
                ? "border-blue-200 bg-blue-50"
                : "border-rose-200 bg-rose-50"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-slate-600">Diferencia</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(differenceAmount)}
          </p>
        </div>
      </div>

      {summary ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Ingresos</p>
            <p className="mt-1 font-semibold text-slate-900">
              {formatCurrency(summary.totals.paymentsIn + summary.totals.adjustmentsIn)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Egresos</p>
            <p className="mt-1 font-semibold text-slate-900">
              {formatCurrency(
                summary.totals.paymentsOut +
                  summary.totals.expenses +
                  summary.totals.withdrawals +
                  summary.totals.adjustmentsOut
              )}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Ventas cobradas</p>
            <p className="mt-1 font-semibold text-slate-900">
              {formatCurrency(summary.totals.salesPayments)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Movimientos</p>
            <p className="mt-1 font-semibold text-slate-900">
              {summary.totals.movementCount} registros
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4">
        <Input
          label="Efectivo contado"
          type="number"
          min="0"
          step="0.01"
          value={String(value.closingAmount)}
          onChange={(event) =>
            onChange({
              ...value,
              closingAmount: Number(event.target.value),
            })
          }
          required
        />
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

      <div className="flex flex-wrap justify-end gap-3">
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
