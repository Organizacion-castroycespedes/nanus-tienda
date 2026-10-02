"use client";

import { useState } from "react";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import {
  voidOperationalSale,
  type VoidOperationalSaleResult,
} from "../services/operational-sales.service";
import type { OperationalSaleDetail } from "../types";
import { ApiError } from "../../../lib/request";

type VoidSaleError = {
  message: string;
  errorCode: string | null;
  solution: string | null;
};

const readVoidSaleError = (err: unknown): VoidSaleError => {
  if (err instanceof ApiError && err.details && typeof err.details === "object") {
    const details = err.details as Record<string, unknown>;
    return {
      message: err.message,
      errorCode: typeof details.errorCode === "string" ? details.errorCode : null,
      solution: typeof details.solution === "string" ? details.solution : null,
    };
  }
  return {
    message: err instanceof Error ? err.message : "Ocurrió un error al intentar anular la venta.",
    errorCode: null,
    solution: null,
  };
};

export const buildVoidSaleSuccessMessage = (result: VoidOperationalSaleResult) => {
  if (result.voidRequest) {
    return result.voidRequest.message;
  }
  if (result.creditNote?.status === "ACCEPTED") {
    const number = result.creditNote.fullNumber ? ` ${result.creditNote.fullNumber}` : "";
    return `Venta anulada. Nota crédito${number} aceptada por la DIAN.`;
  }
  return "Venta anulada correctamente.";
};

const DIAN_DISCREPANCY_REASONS = [
  { code: "2", label: "2 - Anulación de factura electrónica (Total)" },
  { code: "1", label: "1 - Devolución parcial de los bienes y/o no aceptación parcial del servicio" },
  { code: "3", label: "3 - Rebaja total o descuento total aplicado" },
  { code: "4", label: "4 - Ajuste de precio" },
  { code: "5", label: "5 - Otros" },
];

export const VoidSaleModal = ({
  sale,
  isOpen,
  onClose,
  onSuccess,
}: {
  sale: OperationalSaleDetail;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: VoidOperationalSaleResult, message: string) => void;
}) => {
  const [reason, setReason] = useState("");
  const [discrepancyCode, setDiscrepancyCode] = useState("2");
  const [returnInventory, setReturnInventory] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<VoidSaleError | null>(null);

  if (!isOpen) return null;

  const hasElectronicInvoice = sale.electronicBilling?.status === "ACCEPTED";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError({ message: "El motivo debe tener al menos 5 caracteres.", errorCode: null, solution: null });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updated = await voidOperationalSale(sale.id, {
        reason: reason.trim(),
        discrepancyResponseCode: hasElectronicInvoice ? discrepancyCode : undefined,
        discrepancyResponseDescription: hasElectronicInvoice
          ? DIAN_DISCREPANCY_REASONS.find((r) => r.code === discrepancyCode)?.label
          : undefined,
        returnInventory,
      });
      onSuccess(updated, buildVoidSaleSuccessMessage(updated));
      onClose();
    } catch (err) {
      setError(readVoidSaleError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          type="button"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Anular Venta</h2>
            <p className="text-xs text-slate-500">Venta ID: {sale.id.slice(0, 8)}...</p>
          </div>
        </div>

        {hasElectronicInvoice ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
            <strong>Atención:</strong> Esta venta cuenta con <strong>Factura Electrónica aceptada</strong> ({sale.electronicBilling?.documentNumber ?? ""}). Al anularla se emitirá y transmitirá inmediatamente una <strong>Nota Crédito (NC)</strong> a través de FactuCore ante la DIAN. La venta solo se anula cuando la DIAN acepta la NC; si no hay conexión, la anulación queda pendiente y se completa automáticamente.
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
            Esta venta se anulará de forma local en el sistema y se generará el egreso correspondiente en caja.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {hasElectronicInvoice ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Motivo DIAN (DiscrepancyResponse)
              </label>
              <select
                value={discrepancyCode}
                onChange={(e) => setDiscrepancyCode(e.target.value)}
                disabled={loading}
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                {DIAN_DISCREPANCY_REASONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Descripción / Motivo de la Anulación <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="Ej: Cliente canceló la compra o error en medios de pago..."
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="returnInventory"
              checked={returnInventory}
              onChange={(e) => setReturnInventory(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <label htmlFor="returnInventory" className="text-xs text-slate-700">
              Devolver productos al inventario / revertir kardex por lote
            </label>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <p>{error.message}</p>
              {error.errorCode ? (
                <p className="mt-1.5">
                  <strong>Código:</strong> {error.errorCode}
                </p>
              ) : null}
              {error.solution ? (
                <p className="mt-1.5">
                  <strong>Solución:</strong> {error.solution}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || reason.trim().length < 5}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {loading ? (
                "Anulando..."
              ) : (
                <span className="flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4" />
                  Confirmar Anulación
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
