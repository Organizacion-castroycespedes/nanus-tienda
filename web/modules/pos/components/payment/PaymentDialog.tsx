import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Check,
  CreditCard,
  Banknote,
  Landmark,
  QrCode,
  Smartphone,
  Layers,
} from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import type { FinancialInstitution, PaymentMethod } from "../../../finance/types";
import { formatCurrency } from "../../../finance/utils";
import {
  formatPosAmountDisplay,
  getRequiresFinancialInstitutionForPos,
  getRequiresReferenceForPos,
  parsePosAmountInput,
} from "../../utils/pos-payment-rules";
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

type FieldErrors = Record<
  string,
  { amount?: string; reference?: string; institution?: string }
>;

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

const isCashMethod = (m: PaymentMethod) => {
  const text = `${m.codigo || ""} ${m.nombre || ""}`.toLowerCase();
  return m.tipo === "CASH" || text.includes("efectivo") || text.includes("cash");
};

const getMethodIcon = (method: PaymentMethod) => {
  const codeLower = (method.codigo || method.nombre || "").toLowerCase();
  if (codeLower.includes("cash") || codeLower.includes("efectivo")) {
    return <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
  }
  if (codeLower.includes("debit") || codeLower.includes("debito")) {
    return <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
  }
  if (codeLower.includes("credit") || codeLower.includes("credito")) {
    return <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
  }
  if (codeLower.includes("transfer") || codeLower.includes("transferencia")) {
    return <Landmark className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
  }
  if (codeLower.includes("qr") || codeLower.includes("breb")) {
    return <QrCode className="h-5 w-5 text-teal-600 dark:text-teal-400" />;
  }
  if (codeLower.includes("pse")) {
    return <Smartphone className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />;
  }
  return <Layers className="h-5 w-5 text-slate-600 dark:text-slate-400" />;
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [focusPaymentId, setFocusPaymentId] = useState<string | null>(null);
  const [amountDisplay, setAmountDisplay] = useState<Record<string, string>>({});
  const [amountFocused, setAmountFocused] = useState<string | null>(null);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const amountInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const confirmActionRef = useRef<() => void>(() => undefined);
  const canConfirmRef = useRef(false);

  const activeMethods = useMemo(
    () =>
      [...paymentMethods]
        .filter((m) => m.active)
        .sort((a, b) => {
          const aIsCash = isCashMethod(a);
          const bIsCash = isCashMethod(b);
          if (aIsCash && !bIsCash) return -1;
          if (!aIsCash && bIsCash) return 1;
          return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        }),
    [paymentMethods]
  );

  const activeInstitutions = useMemo(
    () => financialInstitutions.filter((i) => i.active !== false),
    [financialInstitutions]
  );

  useEffect(() => {
    if (!open) return;

    const cashMethod = paymentMethods.find((m) => m.active && isCashMethod(m));
    const defaultMethod =
      cashMethod || paymentMethods.find((m) => m.active) || paymentMethods[0];
    const initialAmount = totalAmount > 0 ? String(totalAmount) : "";
    const initialId = "pm-1";

    setPayments([
      {
        id: initialId,
        paymentMethodId: defaultMethod?.id || "",
        amount: initialAmount,
        reference: "",
        financialInstitutionId: null,
      },
    ]);
    setAmountDisplay({
      [initialId]: initialAmount ? formatPosAmountDisplay(initialAmount) : "",
    });
    setValidationError(null);
    setFieldErrors({});
    setFocusPaymentId(initialId);
    setCustomerDropdownOpen(false);
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

  const totalPaid = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  const changeAmount = Math.max(0, totalPaid - totalAmount);
  const pendingAmount = Math.max(0, totalAmount - totalPaid);

  const validatePayments = useCallback(
    (
      rows: PosPaymentRow[],
      pending: number
    ): { ok: boolean; general: string | null; fields: FieldErrors } => {
      const fields: FieldErrors = {};
      let general: string | null = null;

      if (!selectedCustomerId) {
        return {
          ok: false,
          general: "Selecciona un cliente para continuar.",
          fields,
        };
      }

      if (rows.length === 0) {
        return {
          ok: false,
          general: "Agrega al menos un método de pago.",
          fields,
        };
      }

      for (let i = 0; i < rows.length; i++) {
        const p = rows[i];
        const method = paymentMethods.find((m) => m.id === p.paymentMethodId);
        const amountVal = parseFloat(p.amount) || 0;
        const rowErrors: FieldErrors[string] = {};

        if (!p.paymentMethodId || !method) {
          general = `Selecciona un método de pago para la línea #${i + 1}.`;
        }

        if (amountVal <= 0) {
          rowErrors.amount = "Ingresa un monto válido.";
          if (!general) {
            general = `Ingresa un monto válido para el método de pago #${i + 1}.`;
          }
        }

        if (getRequiresReferenceForPos(method) && !p.reference.trim()) {
          rowErrors.reference = "Ingresa el número de referencia.";
          if (!general) {
            general = `Ingresa el número de referencia para el método #${i + 1}.`;
          }
        }

        const requiresInst = getRequiresFinancialInstitutionForPos(method);
        if (requiresInst && !p.financialInstitutionId && activeInstitutions.length > 0) {
          rowErrors.institution = "Selecciona el banco o billetera.";
          if (!general) {
            general = `Selecciona el banco o billetera para el método #${i + 1}.`;
          }
        }

        if (Object.keys(rowErrors).length > 0) {
          fields[p.id] = rowErrors;
        }
      }

      if (pending > 0.009 && !general) {
        general = "El total pagado debe cubrir el total de la venta.";
      }

      const ok = !general && Object.keys(fields).length === 0;
      return { ok, general, fields };
    },
    [selectedCustomerId, paymentMethods, activeInstitutions]
  );

  const validation = validatePayments(payments, pendingAmount);
  const canConfirm =
    Boolean(selectedCustomerId) &&
    payments.length > 0 &&
    pendingAmount <= 0.009 &&
    totalPaid > 0 &&
    validation.ok &&
    !isSubmitting;

  const handleConfirm = useCallback(() => {
    const result = validatePayments(payments, pendingAmount);
    setFieldErrors(result.fields);
    setValidationError(result.general);

    if (!result.ok || isSubmitting) return;
    if (pendingAmount > 0.009) return;

    onConfirm(payments, selectedCustomerId);
  }, [
    validatePayments,
    payments,
    pendingAmount,
    isSubmitting,
    onConfirm,
    selectedCustomerId,
  ]);

  confirmActionRef.current = handleConfirm;
  canConfirmRef.current = canConfirm;

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Enter") return;
      if (isSubmitting || !canConfirmRef.current) return;
      if (customerDropdownOpen) return;

      const target = e.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA") return;
      if (target?.closest("[data-institution-selector]")) return;

      e.preventDefault();
      confirmActionRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, isSubmitting, customerDropdownOpen]);

  const addPaymentRow = () => {
    const defaultMethod = activeMethods[0];
    const totalPaidSoFar = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, totalAmount - totalPaidSoFar);
    const paymentId = `pm-${Date.now()}`;
    const amountStr = remaining > 0 ? String(remaining) : "";

    setPayments((prev) => [
      ...prev,
      {
        id: paymentId,
        paymentMethodId: defaultMethod?.id || "",
        amount: amountStr,
        reference: "",
        financialInstitutionId: null,
      },
    ]);
    setAmountDisplay((prev) => ({
      ...prev,
      [paymentId]: amountStr ? formatPosAmountDisplay(amountStr) : "",
    }));
    setFocusPaymentId(paymentId);
    setValidationError(null);
  };

  const removePaymentRow = (id: string) => {
    if (payments.length <= 1) return;
    setPayments((prev) => prev.filter((p) => p.id !== id));
    setAmountDisplay((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updatePaymentRow = (id: string, field: keyof PosPaymentRow, value: string | null) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (field === "paymentMethodId") {
          return { ...p, paymentMethodId: value as string, financialInstitutionId: null };
        }
        return { ...p, [field]: value };
      })
    );
    setFieldErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev[id] };
      if (field === "reference") delete next.reference;
      if (field === "amount") delete next.amount;
      if (field === "financialInstitutionId") delete next.institution;
      if (field === "paymentMethodId") delete next.institution;
      return { ...prev, [id]: next };
    });
  };

  const handleAmountChange = (id: string, displayValue: string) => {
    setAmountDisplay((prev) => ({ ...prev, [id]: displayValue }));
    const raw = parsePosAmountInput(displayValue);
    updatePaymentRow(id, "amount", raw);
  };

  const handleAmountBlur = (id: string, rawAmount: string) => {
    setAmountFocused(null);
    setAmountDisplay((prev) => ({
      ...prev,
      [id]: rawAmount ? formatPosAmountDisplay(rawAmount) : "",
    }));
  };

  const handleAmountFocus = (id: string, rawAmount: string) => {
    setAmountFocused(id);
    setAmountDisplay((prev) => ({ ...prev, [id]: rawAmount }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-hidden bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-3 md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        className="my-0 flex h-[100dvh] w-full flex-col overflow-hidden border-0 bg-white dark:bg-slate-900 sm:my-auto sm:h-[min(94dvh,860px)] sm:max-h-[94dvh] sm:w-[calc(100vw-24px)] sm:max-w-[1180px] sm:rounded-3xl sm:border sm:border-slate-200/80 dark:sm:border-slate-800"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm dark:bg-blue-500/10 dark:text-blue-400 sm:flex">
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="payment-dialog-title"
                className="text-base font-bold leading-tight text-slate-900 dark:text-white sm:text-lg"
              >
                Cobrar venta
              </h2>
              <p className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">
                Registra los medios de pago para completar la venta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cobro"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid min-h-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-3">
              <CustomerSection
                customers={customers}
                selectedCustomerId={selectedCustomerId}
                onSelectCustomer={onSelectCustomer}
                onUseFinalConsumer={onUseFinalConsumer}
                onOpenQuickFiscalCustomer={onOpenQuickFiscalCustomer}
                finalConsumerCustomer={finalConsumerCustomer}
                onDropdownOpenChange={setCustomerDropdownOpen}
              />

              <div className="rounded-2xl border border-blue-100 bg-blue-50/90 p-3 dark:border-blue-900/50 dark:bg-blue-950/40 lg:hidden">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  Total a cobrar
                </p>
                <p className="mt-0.5 text-2xl font-black leading-tight text-blue-950 dark:text-white">
                  {formatCurrency(totalAmount)}
                </p>
              </div>

              {validationError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {validationError}
                </div>
              )}

              <div className="space-y-3">
                {payments.map((payment, index) => {
                  const selectedMethod = paymentMethods.find(
                    (m) => m.id === payment.paymentMethodId
                  );
                  const requiresFinancialInst =
                    getRequiresFinancialInstitutionForPos(selectedMethod);
                  const errors = fieldErrors[payment.id];
                  const displayAmount =
                    amountFocused === payment.id
                      ? amountDisplay[payment.id] ?? payment.amount
                      : amountDisplay[payment.id] ??
                        (payment.amount ? formatPosAmountDisplay(payment.amount) : "");

                  return (
                    <div
                      key={payment.id}
                      className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-800/40 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          {payments.length > 1
                            ? `Método de pago #${index + 1}`
                            : "Método de pago"}
                        </span>
                        {payments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePaymentRow(payment.id)}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                            aria-label={`Eliminar método de pago ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        )}
                      </div>

                      <div
                        className={
                          requiresFinancialInst
                            ? "grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)]"
                            : "space-y-3"
                        }
                      >
                        <div className="space-y-3">
                          <div
                            className={`grid gap-2 ${
                              requiresFinancialInst
                                ? "grid-cols-2 lg:grid-cols-3"
                                : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
                            }`}
                          >
                            {activeMethods.map((method) => {
                              const isSelected = payment.paymentMethodId === method.id;
                              return (
                                <button
                                  key={method.id}
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() => {
                                    updatePaymentRow(payment.id, "paymentMethodId", method.id);
                                    setFocusPaymentId(payment.id);
                                  }}
                                  className={`flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-all md:min-h-[78px] xl:min-h-[72px] ${
                                    isSelected
                                      ? "border-blue-600 bg-blue-50/80 font-semibold text-blue-700 ring-2 ring-blue-600 dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/50"
                                  }`}
                                >
                                  {getMethodIcon(method)}
                                  <span className="w-full truncate text-[11px] leading-tight">
                                    {method.nombre}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                              <span className="text-xs font-medium">
                                Valor recibido <span className="text-red-600">*</span>
                              </span>
                              <input
                                ref={(input) => {
                                  amountInputRefs.current[payment.id] = input;
                                }}
                                inputMode="decimal"
                                value={displayAmount}
                                onFocus={() => handleAmountFocus(payment.id, payment.amount)}
                                onBlur={() => handleAmountBlur(payment.id, payment.amount)}
                                onChange={(e) => handleAmountChange(payment.id, e.target.value)}
                                placeholder="$ 0"
                                className={`min-h-[44px] w-full rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                                  errors?.amount
                                    ? "border-rose-400 dark:border-rose-500"
                                    : "border-slate-200"
                                }`}
                              />
                              {errors?.amount && (
                                <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                  ⚠ {errors.amount}
                                </span>
                              )}
                            </label>

                            <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                              <span className="text-xs font-medium">
                                Número de referencia <span className="text-red-600">*</span>
                              </span>
                              <div className="relative">
                                <input
                                  value={payment.reference}
                                  onChange={(e) =>
                                    updatePaymentRow(payment.id, "reference", e.target.value)
                                  }
                                  placeholder="123456789"
                                  className={`min-h-[44px] w-full rounded-xl border bg-white px-3 py-2 pr-9 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                                    errors?.reference
                                      ? "border-rose-400 dark:border-rose-500"
                                      : "border-slate-200"
                                  }`}
                                />
                                {payment.reference && (
                                  <button
                                    type="button"
                                    onClick={() => updatePaymentRow(payment.id, "reference", "")}
                                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    aria-label="Limpiar referencia"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                              {errors?.reference && (
                                <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                  ⚠ {errors.reference}
                                </span>
                              )}
                            </label>
                          </div>
                        </div>

                        {requiresFinancialInst && (
                          <div data-institution-selector>
                            <FinancialInstitutionSelector
                              institutions={activeInstitutions}
                              selectedInstitutionId={payment.financialInstitutionId}
                              onSelectInstitution={(instId) => {
                                updatePaymentRow(payment.id, "financialInstitutionId", instId);
                                if (instId) setFocusPaymentId(payment.id);
                              }}
                              error={errors?.institution}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addPaymentRow}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-950/40"
                >
                  <Plus className="h-4 w-4" />
                  Agregar otro medio de pago
                </button>
              </div>

              <div className="lg:hidden">
                <PaymentSummarySidebar
                  totalAmount={totalAmount}
                  totalPaid={totalPaid}
                  changeAmount={changeAmount}
                  pendingAmount={pendingAmount}
                  activeSessionInfo={activeSessionInfo}
                  compact
                />
              </div>
            </div>

            <aside className="hidden lg:block">
              <div className="lg:sticky lg:top-0">
                <PaymentSummarySidebar
                  totalAmount={totalAmount}
                  totalPaid={totalPaid}
                  changeAmount={changeAmount}
                  pendingAmount={pendingAmount}
                  activeSessionInfo={activeSessionInfo}
                />
              </div>
            </aside>
          </div>
        </main>

        <div className="sticky bottom-0 flex flex-shrink-0 flex-col gap-2 border-t border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              ESC
            </kbd>
            <span>para cancelar</span>
            <span className="mx-1 text-slate-300">·</span>
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              Enter
            </kbd>
            <span>para confirmar</span>
          </div>

          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-2.5">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              className="min-h-[48px] w-full rounded-xl px-4 text-sm font-semibold sm:min-h-[44px] sm:w-auto sm:text-xs"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleConfirm}
              isLoading={isSubmitting}
              disabled={!canConfirm}
              className="min-h-[48px] w-full rounded-xl bg-blue-600 px-5 text-sm font-semibold shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 sm:min-h-[44px] sm:w-auto sm:text-xs"
            >
              <Check className="mr-1.5 h-4 w-4" />
              Confirmar venta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
