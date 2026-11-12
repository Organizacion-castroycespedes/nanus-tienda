"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { parseInventoryQuantity, type InventoryCaptureMode } from "./barcode-lines";

type InventoryQuantityStepperProps = {
  name: string;
  quantity: number;
  mode: InventoryCaptureMode;
  disabled?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onCommit: (quantity: number) => void;
  onInvalid: () => void;
  /** Se digitó 0: el formulario decide si confirma la eliminación. */
  onZero: () => void;
};

const stepButtonClass =
  "flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700";

/** Control de cantidad de una línea: −/+ en modo unidad y campo editable (2 decimales). */
export const InventoryQuantityStepper = ({
  name,
  quantity,
  mode,
  disabled = false,
  onIncrement,
  onDecrement,
  onCommit,
  onInvalid,
  onZero,
}: InventoryQuantityStepperProps) => {
  const [draft, setDraft] = useState(String(quantity));
  useEffect(() => setDraft(String(quantity)), [quantity]);

  const commit = () => {
    const text = draft.trim();
    if (text === String(quantity)) {
      return;
    }
    if (text !== "" && Number(text.replace(",", ".")) === 0) {
      setDraft(String(quantity));
      onZero();
      return;
    }
    const parsed = parseInventoryQuantity(text);
    if (parsed === null) {
      setDraft(String(quantity));
      onInvalid();
      return;
    }
    onCommit(parsed);
  };

  return (
    <div className="flex items-center gap-1">
      {mode === "UNIT" ? (
        <button
          type="button"
          aria-label={`Restar una unidad de ${name}`}
          className={stepButtonClass}
          disabled={disabled}
          onClick={onDecrement}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
      <input
        type="text"
        inputMode="decimal"
        aria-label={`Cantidad de ${name}${mode === "WEIGHT" ? " (peso)" : ""}`}
        className="h-10 w-20 rounded-lg border border-slate-200 bg-white text-center text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            setDraft(String(quantity));
          }
        }}
      />
      {mode === "UNIT" ? (
        <button
          type="button"
          aria-label={`Sumar una unidad de ${name}`}
          className={stepButtonClass}
          disabled={disabled}
          onClick={onIncrement}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};
