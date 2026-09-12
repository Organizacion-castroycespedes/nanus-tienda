"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Textarea } from "../../../components/design-system/Textarea";
import type { PurchaseDetailResponse } from "../services/purchase.service";

type SettlePartialPurchaseFormProps = {
  purchase: PurchaseDetailResponse | null;
  loading?: boolean;
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

export const OVERPAYMENT_SETTLEMENT_MESSAGE =
  "No se puede liquidar la compra porque los pagos registrados superan el valor recibido.";

export const validateSettlePartialPurchaseReason = (reason: string) => {
  const normalized = reason.trim();
  if (!normalized) {
    return "El motivo de liquidacion es obligatorio.";
  }
  if (normalized.length < 5) {
    return "El motivo debe tener al menos 5 caracteres.";
  }
  if (normalized.length > 300) {
    return "El motivo no puede superar 300 caracteres.";
  }
  return null;
};

export const getSettlePartialPurchaseSummary = (purchase: PurchaseDetailResponse | null) => {
  const items = purchase?.items ?? [];
  const totalPedido = items.reduce(
    (sum, item) => sum + Number(item.orderedQuantity) * Number(item.cost),
    0
  );
  const totalRecibido = items.reduce(
    (sum, item) => sum + Number(item.receivedQuantity) * Number(item.cost),
    0
  );
  const diferenciaNoRecibida = items.reduce(
    (sum, item) =>
      sum +
      Math.max(Number(item.orderedQuantity) - Number(item.receivedQuantity), 0) *
        Number(item.cost),
    0
  );

  return {
    totalPedido,
    totalRecibido,
    diferenciaNoRecibida,
    totalPagado: Number(purchase?.totalPaid ?? 0),
    saldoDespues: Math.max(totalRecibido - Number(purchase?.totalPaid ?? 0), 0),
    hasOverpayment: Number(purchase?.totalPaid ?? 0) > totalRecibido,
  };
};

export const SettlePartialPurchaseForm = ({
  purchase,
  loading = false,
  reason,
  error,
  isSubmitting = false,
  onReasonChange,
  onCancel,
  onConfirm,
}: SettlePartialPurchaseFormProps) => {
  const summary = getSettlePartialPurchaseSummary(purchase);
  const validationError = validateSettlePartialPurchaseReason(reason);
  const confirmDisabled =
    isSubmitting || loading || !purchase || Boolean(validationError) || summary.hasOverpayment;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-700">Accion de compra</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">Liquidar compra parcial</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Esta accion cerrara la compra con las cantidades realmente recibidas. No podras
            recibir las cantidades pendientes despues de liquidarla.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto">
          Volver
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:text-slate-300">
          Cargando detalle de la compra...
        </div>
      ) : purchase ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Compra</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">{purchase.id.slice(0, 8)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Proveedor</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {purchase.supplierName || purchase.supplierId}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">{purchase.status}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total pedido</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {formatCurrency(summary.totalPedido)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total recibido</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {formatCurrency(summary.totalRecibido)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Diferencia no recibida
              </p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {formatCurrency(summary.diferenciaNoRecibida)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total pagado</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {formatCurrency(summary.totalPagado)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Saldo pendiente despues de liquidar
              </p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {formatCurrency(summary.saldoDespues)}
              </p>
            </div>
          </div>

          {summary.hasOverpayment ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {OVERPAYMENT_SETTLEMENT_MESSAGE}
            </div>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Recibido</th>
                    <th className="px-4 py-3 font-medium">Pendiente</th>
                    <th className="px-4 py-3 font-medium">Valor recibido</th>
                    <th className="px-4 py-3 font-medium">Valor no recibido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchase.items.map((item) => {
                    const pending = Math.max(item.orderedQuantity - item.receivedQuantity, 0);
                    const receivedValue = item.receivedQuantity * item.cost;
                    const unreceivedValue = pending * item.cost;

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">
                          {item.productName || item.productId}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.orderedQuantity}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.receivedQuantity}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{pending}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          {formatCurrency(receivedValue)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          {formatCurrency(unreceivedValue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <Textarea
            label="Motivo de liquidacion"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Ej. proveedor no enviara el saldo pendiente"
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
            <Button onClick={onConfirm} isLoading={isSubmitting} disabled={confirmDisabled} className="w-full sm:w-auto">
              <CheckCircle2 className="h-4 w-4" />
              Confirmar liquidacion
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudo cargar el detalle de la compra.
        </div>
      )}
    </section>
  );
};
