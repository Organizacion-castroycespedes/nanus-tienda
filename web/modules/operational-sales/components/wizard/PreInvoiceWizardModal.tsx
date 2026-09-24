"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "../../../../components/design-system/Modal";
import { PreInvoiceCustomerStep } from "./steps/PreInvoiceCustomerStep";
import { PreInvoicePaymentStep } from "./steps/PreInvoicePaymentStep";
import { PreInvoiceConfirmationStep } from "./steps/PreInvoiceConfirmationStep";
import {
  fetchOperationalSaleDetail,
  updateOperationalSaleCustomer,
  correctOperationalSalePayments,
  requestOperationalSaleElectronicBilling,
} from "../../services/operational-sales.service";
import { getCurrentCashSession } from "../../../finance/services/finance.service";
import type { OperationalSaleDetail } from "../../types";
import type { CashSession } from "../../../finance/types";
import { Check, User, CreditCard, CheckCircle2, Lock } from "lucide-react";

type WizardStep = "CUSTOMER" | "PAYMENTS" | "CONFIRMATION";

type PreInvoiceWizardModalProps = {
  open: boolean;
  saleId: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export const PreInvoiceWizardModal: React.FC<PreInvoiceWizardModalProps> = ({
  open,
  saleId,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<WizardStep>("CUSTOMER");
  const [sale, setSale] = useState<OperationalSaleDetail | null>(null);
  const [activeCashSession, setActiveCashSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !saleId) {
      setSale(null);
      setStep("CUSTOMER");
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchOperationalSaleDetail(saleId),
      getCurrentCashSession().catch(() => null),
    ])
      .then(([saleData, sessionData]) => {
        if (!active) return;
        setSale(saleData);
        setActiveCashSession(sessionData);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error al cargar la venta para facturar.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, saleId]);

  if (!open) return null;

  const stepsConfig = [
    { key: "CUSTOMER" as const, label: "Cliente", icon: User },
    { key: "PAYMENTS" as const, label: "Medios de pago", icon: CreditCard },
    { key: "CONFIRMATION" as const, label: "Confirmación", icon: CheckCircle2 },
  ];

  const currentStepIndex = stepsConfig.findIndex((s) => s.key === step);

  return (
    <Modal
      title="Datos para facturación electrónica"
      description="Revisa y actualiza el cliente o los medios de pago antes de emitir la factura DIAN."
      size="full"
      fullScreen
      responsive
      contentClassName="!rounded-none rounded-none !max-w-none !max-h-none !w-screen !h-screen !h-[100dvh] !border-0 flex flex-col"
      bodyClassName="flex-1 min-h-0 overflow-y-auto pr-1"
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Step Indicator Header with visible Cash Session Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-1 sm:gap-2">
            {stepsConfig.map((s, idx) => {
              const isDone = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              const Icon = s.icon;

              return (
                <div
                  key={s.key}
                  className="flex items-center gap-1.5 sm:gap-2"
                >
                  <div
                    className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isDone
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                          ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : idx + 1}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isCurrent
                        ? "text-slate-900 font-bold dark:text-white"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {s.label}
                  </span>
                  {idx < stepsConfig.length - 1 ? (
                    <div className="h-0.5 w-4 sm:w-10 bg-slate-200 dark:bg-slate-800 mx-0.5 sm:mx-1" />
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Compact Cash Session Status Badge - Always visible, zero vertical clutter */}
          {activeCashSession && activeCashSession.status === "OPEN" ? (
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Caja: <strong>{activeCashSession.cashRegisterNombre ?? "Caja 1"}</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              <span>Caja cerrada</span>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-3" />
            <p>Cargando información de la venta y contexto de caja...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        ) : sale ? (
          <>
            {step === "CUSTOMER" && (
              <PreInvoiceCustomerStep
                sale={sale}
                onCustomerUpdated={(updated) => setSale(updated)}
                onNext={() => setStep("PAYMENTS")}
                onSaveCustomer={(customerId) =>
                  updateOperationalSaleCustomer(sale.id, customerId)
                }
              />
            )}

            {step === "PAYMENTS" && (
              <PreInvoicePaymentStep
                sale={sale}
                activeCashSession={activeCashSession}
                onPaymentsUpdated={(updated) => setSale(updated)}
                onNext={() => setStep("CONFIRMATION")}
                onBack={() => setStep("CUSTOMER")}
                onSavePayments={(payload) =>
                  correctOperationalSalePayments(sale.id, payload)
                }
              />
            )}

            {step === "CONFIRMATION" && (
              <PreInvoiceConfirmationStep
                sale={sale}
                onBack={() => setStep("PAYMENTS")}
                onEmitInvoice={async () => {
                  const result = await requestOperationalSaleElectronicBilling(sale.id);
                  onSuccess(result.message ?? "Solicitud de facturación electrónica enviada exitosamente.");
                  onClose();
                }}
              />
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
};
