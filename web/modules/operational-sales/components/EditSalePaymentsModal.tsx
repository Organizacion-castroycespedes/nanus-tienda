"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "../../../components/design-system/Modal";
import { PreInvoicePaymentStep } from "./wizard/steps/PreInvoicePaymentStep";
import {
  fetchOperationalSaleDetail,
  correctOperationalSalePayments,
} from "../services/operational-sales.service";
import { getCurrentCashSession } from "../../finance/services/finance.service";
import type { OperationalSaleDetail } from "../types";
import type { CashSession } from "../../finance/types";
import { CreditCard, Lock, RotateCcw } from "lucide-react";
import { Button } from "../../../components/design-system/Button";

export type EditSalePaymentsModalProps = {
  open: boolean;
  saleId: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export const EditSalePaymentsModal: React.FC<EditSalePaymentsModalProps> = ({
  open,
  saleId,
  onClose,
  onSuccess,
}) => {
  const [sale, setSale] = useState<OperationalSaleDetail | null>(null);
  const [activeCashSession, setActiveCashSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    if (!saleId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchOperationalSaleDetail(saleId),
      getCurrentCashSession().catch(() => null),
    ])
      .then(([saleData, sessionData]) => {
        setSale(saleData);
        setActiveCashSession(sessionData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al cargar los datos de la venta.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!open || !saleId) {
      setSale(null);
      setError(null);
      return;
    }
    loadData();
  }, [open, saleId]);

  if (!open) return null;

  const hasOpenCashSession = Boolean(activeCashSession && activeCashSession.status === "OPEN");
  const isSameShift = Boolean(
    sale && (!sale.cashSessionId || !activeCashSession || sale.cashSessionId === activeCashSession.id)
  );

  return (
    <Modal
      title="Editar medios de pago"
      description="Modifica los medios de pago de la venta registrada en el turno de caja actual."
      size="full"
      fullScreen
      responsive
      contentClassName="!rounded-none rounded-none !max-w-none !max-h-none !w-screen !h-screen !h-[100dvh] !border-0 flex flex-col"
      bodyClassName="flex-1 min-h-0 overflow-y-auto pr-1"
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Header with Turno/Caja Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Venta #{sale ? sale.id.slice(0, 8) : saleId?.slice(0, 8)}
              </p>
              {sale ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cliente: <strong className="text-slate-700 dark:text-slate-200">{sale.customer.name}</strong>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasOpenCashSession && isSameShift ? (
              <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>Caja: <strong>{activeCashSession?.cashRegisterNombre ?? "Caja actual"}</strong> · Turno abierto</span>
              </div>
            ) : hasOpenCashSession && !isSameShift ? (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <span>Turno de venta cerrado</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <span>Caja cerrada</span>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Cargando datos de la venta y caja...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 space-y-3">
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={loadData}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Reintentar
            </Button>
          </div>
        ) : sale ? (
          <PreInvoicePaymentStep
            sale={sale}
            activeCashSession={activeCashSession}
            onPaymentsUpdated={(updatedSale) => {
              setSale(updatedSale);
            }}
            onSavePayments={(payload) => correctOperationalSalePayments(sale.id, payload)}
            standalone
            autoStartEditing
            onClose={() => {
              onSuccess("Medios de pago actualizados correctamente.");
              onClose();
            }}
          />
        ) : null}
      </div>
    </Modal>
  );
};
