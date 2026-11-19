"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { InventoryQuantityStepper } from "../barcode/InventoryQuantityStepper";
import {
  getPurchaseLineSubtotal,
  parsePurchaseCost,
  type PurchaseCaptureLine,
} from "./purchase-capture-lines";

export type PurchaseInvoiceRow = {
  line: PurchaseCaptureLine;
  name: string;
  code: string | null;
};

type PurchaseInvoiceTableProps = {
  rows: readonly PurchaseInvoiceRow[];
  highlightedProductId: string | null;
  disabled?: boolean;
  onIncrement: (line: PurchaseCaptureLine) => void;
  onDecrement: (line: PurchaseCaptureLine) => void;
  onSetQuantity: (line: PurchaseCaptureLine, quantity: number) => void;
  onSetCost: (line: PurchaseCaptureLine, cost: number) => void;
  onInvalidQuantity: () => void;
  onInvalidCost: () => void;
  onRemove: (line: PurchaseCaptureLine) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const CostField = ({
  row,
  disabled,
  onCommit,
  onInvalid,
}: {
  row: PurchaseInvoiceRow;
  disabled?: boolean;
  onCommit: (cost: number) => void;
  onInvalid: () => void;
}) => {
  const [draft, setDraft] = useState(String(row.line.cost));
  useEffect(() => setDraft(String(row.line.cost)), [row.line.cost]);

  const commit = () => {
    if (draft.trim() === String(row.line.cost)) {
      return;
    }
    const cost = parsePurchaseCost(draft);
    if (cost === null) {
      setDraft(String(row.line.cost));
      onInvalid();
      return;
    }
    onCommit(cost);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={`Costo unitario de ${row.name}`}
      className={`h-10 w-full min-w-0 rounded-lg border bg-white px-2 text-right text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-900 dark:text-white ${
        row.line.cost === 0 ? "border-amber-300 dark:border-amber-500/60" : "border-slate-200 dark:border-slate-700"
      }`}
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
          setDraft(String(row.line.cost));
        }
      }}
    />
  );
};

export const PurchaseInvoiceTable = ({
  rows,
  highlightedProductId,
  disabled = false,
  onIncrement,
  onDecrement,
  onSetQuantity,
  onSetCost,
  onInvalidQuantity,
  onInvalidCost,
  onRemove,
}: PurchaseInvoiceTableProps) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        Escanea los productos de la factura del proveedor o búscalos por nombre.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="hidden grid-cols-[2.5rem_9rem_minmax(12rem,2fr)_11rem_9rem_9rem_3rem] gap-3 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 lg:grid dark:bg-slate-900 dark:text-slate-300">
        <span>#</span>
        <span>Código</span>
        <span>Producto</span>
        <span className="text-center">Cantidad</span>
        <span className="text-right">Costo unit.</span>
        <span className="text-right">Subtotal</span>
        <span className="sr-only">Acciones</span>
      </div>
      <ol aria-label="Productos de la compra" className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800">
        {rows.map((row, index) => (
          <li
            key={row.line.productId}
            className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 lg:grid-cols-[2.5rem_9rem_minmax(12rem,2fr)_11rem_9rem_9rem_3rem] lg:items-center ${
              row.line.productId === highlightedProductId ? "bg-blue-50/70 dark:bg-blue-500/10" : ""
            }`}
          >
            <span className="hidden text-sm tabular-nums text-slate-500 lg:block">{index + 1}</span>
            <span className="hidden break-all text-xs text-slate-500 lg:block dark:text-slate-400">
              {row.code ?? "—"}
            </span>
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <p className="break-words text-sm font-medium leading-5 text-slate-900 dark:text-white">
                <span className="mr-1 text-slate-400 lg:hidden">{index + 1}.</span>
                {row.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {[row.code ? `Código ${row.code}` : null, row.line.mode === "WEIGHT" ? "Por peso" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {row.line.cost === 0 ? (
                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Sin costo: revisa el valor de la factura.
                </p>
              ) : null}
            </div>
            <div className="flex lg:justify-center">
              <InventoryQuantityStepper
                name={row.name}
                quantity={row.line.quantity}
                mode={row.line.mode}
                disabled={disabled}
                onIncrement={() => onIncrement(row.line)}
                onDecrement={() => onDecrement(row.line)}
                onCommit={(quantity) => onSetQuantity(row.line, quantity)}
                onInvalid={onInvalidQuantity}
                onZero={() => onRemove(row.line)}
              />
            </div>
            <div className="w-28 justify-self-end lg:w-full">
              <CostField
                row={row}
                disabled={disabled}
                onCommit={(cost) => onSetCost(row.line, cost)}
                onInvalid={onInvalidCost}
              />
            </div>
            <p className="self-center text-sm font-semibold tabular-nums text-slate-900 lg:text-right dark:text-white">
              <span className="mr-1 text-xs font-normal text-slate-500 lg:hidden">Subtotal</span>
              {formatCurrency(getPurchaseLineSubtotal(row.line))}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                aria-label={`Eliminar ${row.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-500/10"
                disabled={disabled}
                onClick={() => onRemove(row.line)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
