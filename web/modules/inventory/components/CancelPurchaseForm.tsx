"use client";

import { XCircle } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Textarea } from "../../../components/design-system/Textarea";
import type { PurchaseResponse } from "../services/purchase.service";

type CancelPurchaseFormProps = {
  purchase: PurchaseResponse;
  reason: string;
  error?: string | null;
  isSubmitting?: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

export const validateCancelPurchaseReason = (reason: string) => {
  const normalized = reason.trim();
  if (!normalized) {
    return "El motivo de cancelacion es obligatorio.";
  }
  if (normalized.length < 5) {
    return "El motivo debe tener al menos 5 caracteres.";
  }
  if (normalized.length > 300) {
    return "El motivo no puede superar 300 caracteres.";
  }
  return null;
};

export const CancelPurchaseForm = ({
  purchase,
  reason,
  error,
  isSubmitting = false,
  onReasonChange,
  onCancel,
  onConfirm,
}: CancelPurchaseFormProps) => {
  const validationError = validateCancelPurchaseReason(reason);
  const confirmDisabled = isSubmitting || Boolean(validationError);

  return (
    <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-rose-600">Accion de compra</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Cancelar compra</h2>
            <p className="mt-2 text-sm text-slate-600">
              Esta accion cambiara el estado de la compra y bloqueara nuevas operaciones sobre
              ella.
            </p>
          </div>
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto">
            Volver
          </Button>
        </div>

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Compra</p>
            <p className="mt-1 font-medium text-slate-900">{purchase.id.slice(0, 8)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Proveedor</p>
            <p className="mt-1 font-medium text-slate-900">
              {purchase.supplierName || purchase.supplierId}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Estado actual</p>
            <p className="mt-1 font-medium text-slate-900">{purchase.status}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 font-medium text-slate-900">
              {formatCurrency(Number(purchase.total))}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Pago</p>
            <p className="mt-1 font-medium text-slate-900">{purchase.paymentStatus}</p>
          </div>
        </div>

        <Textarea
          label="Motivo de cancelacion"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Ej. proveedor no despachara la mercancia"
          rows={4}
          maxLength={300}
          disabled={isSubmitting}
        />
        {reason.trim() && validationError ? (
          <p className="text-xs text-rose-600">{validationError}</p>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto">
            Volver
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            isLoading={isSubmitting}
            disabled={confirmDisabled}
            className="w-full sm:w-auto"
          >
            <XCircle className="h-4 w-4" />
            Confirmar cancelacion
          </Button>
        </div>
      </div>
    </section>
  );
};
