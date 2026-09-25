"use client";

import React, { useState } from "react";
import { User, CreditCard, FileText, CheckCircle2, ArrowLeft, Send } from "lucide-react";
import { Button } from "../../../../../components/design-system/Button";
import { formatCurrency } from "../../../../finance/utils";
import type { OperationalSaleDetail } from "../../../types";

type PreInvoiceConfirmationStepProps = {
  sale: OperationalSaleDetail;
  onBack: () => void;
  onEmitInvoice: () => Promise<void>;
};

const formatPaymentStatus = (status: string) => {
  switch (status?.toUpperCase()) {
    case "PAID":
      return "Pagada";
    case "PENDING":
      return "Pendiente";
    case "PARTIAL":
      return "Parcial";
    case "CANCELLED":
      return "Cancelada";
    default:
      return "Pagada";
  }
};

export const PreInvoiceConfirmationStep: React.FC<PreInvoiceConfirmationStepProps> = ({
  sale,
  onBack,
  onEmitInvoice,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onEmitInvoice();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al solicitar la factura electrónica"
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Customer Summary Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <User className="h-4 w-4" />
            <span>Cliente para Factura</span>
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {sale.customer.name ?? "Cliente sin nombre"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sale.customer.documentNumber
                ? `CC / NIT: ${sale.customer.documentNumber}`
                : "Sin documento registrado"}
            </p>
          </div>
        </div>

        {/* Financial Summary Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <FileText className="h-4 w-4" />
            <span>Monto a Facturar</span>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(sale.total)}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Venta cerrada • Estado: {formatPaymentStatus(sale.paymentStatus)}
            </p>
          </div>
        </div>
      </div>

      {/* Payment methods summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <CreditCard className="h-4 w-4" />
          <span>Medios de pago</span>
        </div>

        {sale.payments && sale.payments.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sale.payments.map((p, idx) => (
              <div key={p.id || idx} className="flex justify-between py-2.5 text-xs">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {p.paymentMethod ?? "Método de pago"}
                  </span>
                  {p.financialInstitutionNombre ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}• {p.financialInstitutionNombre}
                    </span>
                  ) : null}
                  {p.referenceNumber ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}• Ref: {p.referenceNumber}
                    </span>
                  ) : null}
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(p.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Pago registrado por valor total.</p>
        )}
      </div>

      {/* DIAN info notice */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200 flex items-start gap-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="font-semibold">Listo para emitir factura electrónica</p>
          <p className="mt-0.5">
            Al pulsar &quot;Emitir factura&quot;, se enviará la solicitud de facturación electrónica ante la DIAN. No se crearán ventas adicionales ni se afectará el inventario ni los movimientos de caja.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        <Button
          variant="outline"
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Medios de Pago
        </Button>
        <Button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={submitting}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Send className="h-4 w-4" />
          {submitting ? "Emitiendo factura electrónica..." : "Emitir factura"}
        </Button>
      </div>
    </div>
  );
};
