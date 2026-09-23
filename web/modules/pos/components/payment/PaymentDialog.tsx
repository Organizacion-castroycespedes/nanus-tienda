import React, { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, Check, CreditCard, Banknote, Landmark, QrCode, Smartphone, Layers } from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import type { FinancialInstitution, PaymentMethod } from "../../../finance/types";
import { CustomerSection } from "./CustomerSection";
import { FinancialInstitutionSelector } from "./FinancialInstitutionSelector";
import { PaymentSummarySidebar } from "./PaymentSummarySidebar";

export type PosPaymentRow = {
  id: string;
  paymentMethodId: string;
  amount: string;
  reference: string;
  financialInstitutionId: string | null;
};

type Customer = {
  id: string;
  name: string;
  documentNumber?: string | null;
};

type PaymentDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payments: PosPaymentRow[], selectedCustomerId: string | null) => void;
  totalAmount: number;
  paymentMethods: PaymentMethod[];
  financialInstitutions: FinancialInstitution[];
  customers: Customer[];
  selectedCustomerId: string | null;
  onSelectCustomer: (id: string) => void;
  onUseFinalConsumer: () => void;
  onOpenQuickFiscalCustomer: () => void;
  finalConsumerCustomer?: Customer | null;
  activeSessionInfo?: {
    cashRegisterName?: string;
    terminalName?: string;
    branchName?: string;
  } | null;
  isSubmitting?: boolean;
};

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onClose,
  onConfirm,
  totalAmount,
  paymentMethods,
  financialInstitutions,
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onUseFinalConsumer,
  onOpenQuickFiscalCustomer,
  finalConsumerCustomer,
  activeSessionInfo,
  isSubmitting = false,
}) => {
  const [payments, setPayments] = useState<PosPaymentRow[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [focusPaymentId, setFocusPaymentId] = useState<string | null>(null);
  const amountInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (open) {
      const cashMethod = paymentMethods.find(
        (m) =>
          m.active &&
          ((m.codigo || m.nombre || "").toLowerCase().includes("efectivo") ||
            (m.codigo || m.nombre || "").toLowerCase().includes("cash") ||
            m.tipo === "CASH")
      );
      const defaultMethod = cashMethod || paymentMethods.find((m) => m.active) || paymentMethods[0];
      setPayments([
        {
          id: "pm-1",
          paymentMethodId: defaultMethod?.id || "",
          amount: totalAmount > 0 ? String(totalAmount) : "",
          reference: "",
          financialInstitutionId: null,
        },
      ]);
      setValidationError(null);
      setFocusPaymentId("pm-1");
    }
  }, [open, totalAmount, paymentMethods]);

  useEffect(() => {
    if (!open || !focusPaymentId) return;

    const timer = window.setTimeout(() => {
      const input = amountInputRefs.current[focusPaymentId];
      if (!input) return;
      input.focus();
      input.select();
      setFocusPaymentId(null);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [focusPaymentId, open, payments]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const activeMethods = [...paymentMethods]
    .filter((m) => m.active)
    .sort((a, b) => {
      const aIsCash =
        (a.codigo || a.nombre || "").toLowerCase().includes("efectivo") ||
        (a.codigo || a.nombre || "").toLowerCase().includes("cash") ||
        a.tipo === "CASH";
      const bIsCash =
        (b.codigo || b.nombre || "").toLowerCase().includes("efectivo") ||
        (b.codigo || b.nombre || "").toLowerCase().includes("cash") ||
        b.tipo === "CASH";
      if (aIsCash && !bIsCash) return -1;
      if (!aIsCash && bIsCash) return 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

  const getMethodIcon = (method: PaymentMethod) => {
    const codeLower = (method.codigo || method.nombre || "").toLowerCase();
    if (codeLower.includes("cash") || codeLower.includes("efectivo")) return <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
    if (codeLower.includes("debit") || codeLower.includes("debito")) return <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    if (codeLower.includes("credit") || codeLower.includes("credito")) return <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
    if (codeLower.includes("transfer") || codeLower.includes("transferencia")) return <Landmark className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
    if (codeLower.includes("qr")) return <QrCode className="h-5 w-5 text-teal-600 dark:text-teal-400" />;
    if (codeLower.includes("pse")) return <Smartphone className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />;
    return <Layers className="h-5 w-5 text-slate-600 dark:text-slate-400" />;
  };

  const addPaymentRow = () => {
    const defaultMethod = activeMethods[0];
    const totalPaidSoFar = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, totalAmount - totalPaidSoFar);
    const paymentId = `pm-${Date.now()}`;

    setPayments((prev) => [
      ...prev,
      {
        id: paymentId,
        paymentMethodId: defaultMethod?.id || "",
        amount: remaining > 0 ? String(remaining) : "",
        reference: "",
        financialInstitutionId: null,
      },
    ]);
    setFocusPaymentId(paymentId);
  };

  const removePaymentRow = (id: string) => {
    if (payments.length <= 1) return;
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePaymentRow = (id: string, field: keyof PosPaymentRow, value: string | null) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (field === "paymentMethodId") {
          // Reset financial institution if changing method
          return { ...p, paymentMethodId: value as string, financialInstitutionId: null };
        }
        return { ...p, [field]: value };
      })
    );
  };

  const totalPaid = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  const changeAmount = Math.max(0, totalPaid - totalAmount);
  const pendingAmount = Math.max(0, totalAmount - totalPaid);

  const handleConfirm = () => {
    setValidationError(null);

    // Validate rows
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      const method = paymentMethods.find((m) => m.id === p.paymentMethodId);
      const amountVal = parseFloat(p.amount) || 0;

      if (amountVal <= 0) {
        setValidationError(`Ingresa un monto válido para el método de pago #${i + 1}.`);
        return;
      }

      const requiresRef = method?.requiresReference ?? true; // Always mandatory by business rule
      if (requiresRef && !p.reference.trim()) {
        setValidationError(`Ingresa el número de referencia para el método #${i + 1}.`);
        return;
      }

      const requiresInst = method?.requiresFinancialInstitution || ["TRANSFER", "BANK", "QR", "PSE"].includes(method?.tipo || "") || (method?.nombre || "").toLowerCase().includes("transfer");
      if (requiresInst && !p.financialInstitutionId && financialInstitutions.length > 0) {
        setValidationError(`Selecciona el banco o billetera para el método #${i + 1}.`);
        return;
      }
    }

    onConfirm(payments, selectedCustomerId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-1.5 sm:p-3 backdrop-blur-sm overflow-hidden">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:h-auto sm:max-h-[min(96vh,720px)] sm:w-[calc(100vw-1.5rem)] sm:max-w-[1040px] xl:max-w-[1100px] sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 shadow-sm">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Cobrar venta
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Registra los medios de pago para completar la venta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid min-h-0 grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_310px]">
            
            {/* Main Form Left Column */}
            <div className="min-h-0 space-y-3 lg:pr-1">
              
              {/* 1. Customer Section */}
              <CustomerSection
                customers={customers}
                selectedCustomerId={selectedCustomerId}
                onSelectCustomer={onSelectCustomer}
                onUseFinalConsumer={onUseFinalConsumer}
                onOpenQuickFiscalCustomer={onOpenQuickFiscalCustomer}
                finalConsumerCustomer={finalConsumerCustomer}
              />

              {/* Validation Alert */}
              {validationError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs font-medium text-rose-700 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {validationError}
                </div>
              )}

              {/* 2. Payment Method Rows */}
              <div className="space-y-3">
                {payments.map((payment, index) => {
                  const selectedMethod = paymentMethods.find((m) => m.id === payment.paymentMethodId);
                  const requiresFinancialInst =
                    selectedMethod?.requiresFinancialInstitution ||
                    ["TRANSFER", "BANK", "QR", "PSE"].includes(selectedMethod?.tipo || "") ||
                    (selectedMethod?.nombre || "").toLowerCase().includes("transfer") ||
                    (selectedMethod?.nombre || "").toLowerCase().includes("qr") ||
                    (selectedMethod?.nombre || "").toLowerCase().includes("pse");

                  return (
                    <div
                      key={payment.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-sm transition dark:border-slate-800 dark:bg-slate-800/40 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          Método de pago #{index + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={addPaymentRow}
                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                          >
                            <Plus className="h-3 w-3" />
                            Agregar otro método
                          </button>
                          {payments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePaymentRow(payment.id)}
                              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold transition"
                            >
                              <Trash2 className="h-3 w-3" />
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        className={
                          requiresFinancialInst
                            ? "grid grid-cols-1 sm:grid-cols-[minmax(220px,0.85fr)_minmax(270px,1.15fr)] gap-3 items-start"
                            : "space-y-2.5"
                        }
                      >
                        <div className="space-y-2.5">
                          {/* Payment Method Cards */}
                          <div className={`grid ${requiresFinancialInst ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"} gap-2`}>
                            {activeMethods.map((method) => {
                              const isSelected = payment.paymentMethodId === method.id;
                              return (
                                <button
                                  key={method.id}
                                  type="button"
                                  onClick={() => {
                                    updatePaymentRow(payment.id, "paymentMethodId", method.id);
                                    setFocusPaymentId(payment.id);
                                  }}
                                  className={`flex h-[54px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border p-1 text-center transition-all ${
                                    isSelected
                                      ? "border-blue-600 bg-blue-50/80 font-semibold text-blue-700 ring-2 ring-blue-600 dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500 shadow-sm"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/50"
                                  }`}
                                >
                                  {getMethodIcon(method)}
                                  <span className="w-full truncate text-[10.5px] leading-tight">{method.nombre}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Amount & Reference Inputs */}
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              ref={(input) => {
                                amountInputRefs.current[payment.id] = input;
                              }}
                              label="Valor recibido *"
                              inputMode="decimal"
                              value={payment.amount}
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(e) => updatePaymentRow(payment.id, "amount", e.target.value)}
                              placeholder="$ 0"
                              className="rounded-xl text-xs font-semibold"
                            />

                            <div className="relative">
                              <Input
                                label="No. Referencia *"
                                value={payment.reference}
                                onChange={(e) => updatePaymentRow(payment.id, "reference", e.target.value)}
                                placeholder="123456789"
                                className="rounded-xl text-xs font-medium pr-7"
                              />
                              {payment.reference && (
                                <button
                                  type="button"
                                  onClick={() => updatePaymentRow(payment.id, "reference", "")}
                                  className="absolute right-2 top-[30px] rounded-full p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Financial Institution Selector (Contextual) */}
                        {requiresFinancialInst && (
                          <FinancialInstitutionSelector
                            institutions={financialInstitutions}
                            selectedInstitutionId={payment.financialInstitutionId}
                            onSelectInstitution={(instId) => {
                              updatePaymentRow(payment.id, "financialInstitutionId", instId);
                              if (instId) setFocusPaymentId(payment.id);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Payment Summary Sidebar */}
            <div>
              <PaymentSummarySidebar
                totalAmount={totalAmount}
                totalPaid={totalPaid}
                changeAmount={changeAmount}
                pendingAmount={pendingAmount}
                activeSessionInfo={activeSessionInfo}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900 flex-shrink-0">
          <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5">
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              ESC
            </kbd>
            <span>para cancelar</span>
          </div>

          <div className="flex w-full sm:w-auto items-center justify-end gap-2.5">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              className="w-1/2 sm:w-auto rounded-xl px-4 h-8 text-xs font-semibold"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleConfirm}
              isLoading={isSubmitting}
              className="w-1/2 sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold px-5 h-8 text-xs shadow-md shadow-blue-600/20"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Confirmar venta
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
