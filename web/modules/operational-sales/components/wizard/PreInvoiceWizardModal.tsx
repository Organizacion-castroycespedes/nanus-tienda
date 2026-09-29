"use client";

import React, { useEffect, useState } from "react";
import { WizardModal, type WizardStepConfig } from "../../../../components/design-system/WizardModal";
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
import { User, CreditCard, CheckCircle2, Lock } from "lucide-react";

type WizardStep = "CUSTOMER" | "PAYMENTS" | "CONFIRMATION";

type PreInvoiceWizardModalProps = {
  open: boolean;
  saleId: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

const stepsConfig: WizardStepConfig[] = [
  { key: "CUSTOMER", label: "Cliente", icon: User },
  { key: "PAYMENTS", label: "Medios de pago", icon: CreditCard },
  { key: "CONFIRMATION", label: "Confirmación", icon: CheckCircle2 },
];

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

  const currentStepIndex = stepsConfig.findIndex((s) => s.key === step);

  const cashSessionBadge = (
    <div>
      {activeCashSession && activeCashSession.status === "OPEN" ? (
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>
            Caja: <strong>{activeCashSession.cashRegisterNombre ?? "Caja 1"}</strong>
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <Lock className="h-3.5 w-3.5 text-amber-600" />
          <span>Caja cerrada</span>
        </div>
      )}
    </div>
  );

  return (
    <WizardModal
      open={open}
      title="Datos para facturación electrónica"
      description="Revisa y actualiza el cliente o los medios de pago antes de emitir la factura DIAN."
      steps={stepsConfig}
      currentStepIndex={currentStepIndex}
      size="full"
      fullScreen={true}
      headerBadge={cashSessionBadge}
      error={error}
      onDismissError={() => setError(null)}
      onClose={onClose}
      customFooter={<div className="hidden" />}
    >
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-3" />
            <p>Cargando información de la venta y contexto de caja...</p>
          </div>
        ) : sale ? (
          <div className="space-y-4">
            {step === "CUSTOMER" && (
              <PreInvoiceCustomerStep
                sale={sale}
                onCustomerUpdated={(updated) => {
                  setSale(updated);
                  setError(null);
                }}
                onNext={() => {
                  setError(null);
                  setStep("PAYMENTS");
                }}
                onSaveCustomer={(customerId) =>
                  updateOperationalSaleCustomer(sale.id, customerId)
                }
              />
            )}

            {step === "PAYMENTS" && (
              <PreInvoicePaymentStep
                sale={sale}
                activeCashSession={activeCashSession}
                onPaymentsUpdated={(updated) => {
                  setSale(updated);
                  setError(null);
                }}
                onNext={() => {
                  setError(null);
                  setStep("CONFIRMATION");
                }}
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
                  setError(null);
                  const result = await requestOperationalSaleElectronicBilling(sale.id);
                  const isSuccess =
                    result.requestCreated ||
                    result.result === "REQUESTED" ||
                    result.result === "DOCUMENT_EXISTS";

                  if (!isSuccess) {
                    const errorMsg =
                      result.message ||
                      "No se pudo crear la solicitud de facturación electrónica.";

                    if (
                      result.eligibility === "INCOMPLETE_CUSTOMER_FISCAL_DATA" ||
                      result.result === "INCOMPLETE_CUSTOMER_FISCAL_DATA"
                    ) {
                      setError(errorMsg);
                      setStep("CUSTOMER");
                    } else {
                      setError(errorMsg);
                    }
                    throw new Error(errorMsg);
                  }

                  onSuccess(
                    result.message ?? "Solicitud de facturación electrónica enviada exitosamente."
                  );
                  onClose();
                }}
              />
            )}
          </div>
        ) : null}
      </div>
    </WizardModal>
  );
};
