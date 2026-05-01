"use client";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Textarea } from "../../../components/design-system/Textarea";
import type { CloseCashSessionPayload } from "../types";
import { formatCurrency } from "../utils";

type CloseCashSessionFormProps = {
  value: CloseCashSessionPayload;
  expectedAmount: number;
  onChange: (value: CloseCashSessionPayload) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
};

export const CloseCashSessionForm = ({
  value,
  expectedAmount,
  onChange,
  onCancel,
  onSubmit,
  isSaving = false,
}: CloseCashSessionFormProps) => (
  <div className="space-y-4">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-amber-700">Esperado</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {formatCurrency(expectedAmount)}
      </p>
    </div>

    <div className="grid gap-4">
      <Input
        label="Monto de cierre"
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
