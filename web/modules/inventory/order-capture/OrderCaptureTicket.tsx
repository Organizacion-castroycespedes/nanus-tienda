"use client";

import { Trash2 } from "lucide-react";

import { InventoryQuantityStepper } from "../barcode/InventoryQuantityStepper";
import type {
  OrderCaptureLine,
  OrderLineAmounts,
  OrderLinePricingState,
  OrderStockWarning,
} from "./order-capture-lines";

export type OrderTicketRow = {
  line: OrderCaptureLine;
  name: string;
  sku: string | null;
  amounts: OrderLineAmounts;
  pricing: OrderLinePricingState | undefined;
  stockWarning: OrderStockWarning | null;
};

type OrderCaptureTicketProps = {
  rows: readonly OrderTicketRow[];
  highlightedProductId: string | null;
  disabled?: boolean;
  onIncrement: (line: OrderCaptureLine) => void;
  onDecrement: (line: OrderCaptureLine) => void;
  onSetQuantity: (line: OrderCaptureLine, quantity: number) => void;
  onInvalidQuantity: (name: string) => void;
  onRemove: (line: OrderCaptureLine) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);

const pricingLabel = (row: OrderTicketRow) => {
  if (row.amounts.fromBackend) {
    const preview = row.pricing?.status === "ready" ? row.pricing.preview : null;
    return preview?.appliedPromotionName ? `Promoción: ${preview.appliedPromotionName}` : null;
  }
  switch (row.pricing?.status) {
    case "loading":
      return "Calculando precio…";
    case "pending":
      return "Precio pendiente (sin conexión); se recalcula al guardar";
    case "forbidden":
      return "Precio de lista; se recalcula al guardar";
    case "error":
      return "No se pudo calcular; se recalcula al guardar";
    default:
      return row.line.listPrice > 0 ? null : "Sin precio de lista; el sistema lo calcula al guardar";
  }
};

export const OrderCaptureTicket = ({
  rows,
  highlightedProductId,
  disabled = false,
  onIncrement,
  onDecrement,
  onSetQuantity,
  onInvalidQuantity,
  onRemove,
}: OrderCaptureTicketProps) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        Escanea un producto o búscalo por nombre para empezar el pedido.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="hidden grid-cols-[minmax(14rem,2fr)_11rem_9rem_9rem_3rem] gap-3 border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid dark:border-slate-700 dark:text-slate-400">
        <span>Producto</span>
        <span className="text-center">Cantidad</span>
        <span className="text-right">Precio unit.</span>
        <span className="text-right">Total</span>
        <span className="sr-only">Acciones</span>
      </div>
      <ul aria-label="Productos del pedido" className="divide-y divide-slate-100 dark:divide-slate-700">
        {rows.map((row) => {
          const label = pricingLabel(row);
          const isHighlighted = row.line.productId === highlightedProductId;
          return (
            <li
              key={row.line.productId}
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 md:grid-cols-[minmax(14rem,2fr)_11rem_9rem_9rem_3rem] md:items-center ${
                isHighlighted ? "bg-blue-50/70 dark:bg-blue-500/10" : ""
              }`}
            >
              <div className="col-span-2 min-w-0 md:col-span-1">
                <p className="break-words text-sm font-medium leading-5 text-slate-900 dark:text-white">
                  {row.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[row.sku, row.line.mode === "WEIGHT" ? "Por peso" : null].filter(Boolean).join(" · ")}
                </p>
                {row.stockWarning ? (
                  <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Stock insuficiente (disponible: {formatQuantity(row.stockWarning.available)})
                  </p>
                ) : null}
                {label ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p> : null}
              </div>

              <div className="flex md:justify-center">
                <InventoryQuantityStepper
                  name={row.name}
                  quantity={row.line.quantity}
                  mode={row.line.mode}
                  disabled={disabled}
                  onIncrement={() => onIncrement(row.line)}
                  onDecrement={() => onDecrement(row.line)}
                  onCommit={(quantity) => onSetQuantity(row.line, quantity)}
                  onInvalid={() => onInvalidQuantity(row.name)}
                  onZero={() => onRemove(row.line)}
                />
              </div>

              <p className="hidden text-right text-sm tabular-nums text-slate-700 md:block dark:text-slate-200">
                {formatCurrency(row.amounts.unitPrice)}
              </p>
              <p className="self-center text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(row.amounts.lineTotal)}
              </p>
              <div className="col-span-2 flex justify-end md:col-span-1">
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
          );
        })}
      </ul>
    </div>
  );
};
