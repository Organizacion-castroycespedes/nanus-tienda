"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Banknote,
  CreditCard,
  Landmark,
  Layers,
  QrCode,
  Smartphone,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Edit3,
  X,
} from "lucide-react";
import { Button } from "../../../../../components/design-system/Button";
import { FinancialInstitutionSelector } from "../../../../pos/components/payment/FinancialInstitutionSelector";
import {
  listPaymentMethods,
  listFinancialInstitutions,
} from "../../../../finance/services/finance.service";
import type { PaymentMethod, FinancialInstitution, CashSession } from "../../../../finance/types";
import { formatCurrency } from "../../../../finance/utils";
import {
  formatPosAmountDisplay,
  getRequiresFinancialInstitutionForPos,
  getRequiresReferenceForPos,
  parsePosAmountInput,
} from "../../../../pos/utils/pos-payment-rules";
import type { OperationalSaleDetail } from "../../../types";
import type { CorrectOperationalSalePaymentsPayload } from "../../../services/operational-sales.service";

type PreInvoicePaymentStepProps = {
  sale: OperationalSaleDetail;
  activeCashSession: CashSession | null;
  onPaymentsUpdated: (sale: OperationalSaleDetail) => void;
  onNext?: () => void;
  onBack?: () => void;
  onSavePayments: (
    payload: CorrectOperationalSalePaymentsPayload
  ) => Promise<OperationalSaleDetail>;
  standalone?: boolean;
  onClose?: () => void;
  autoStartEditing?: boolean;
};

type PaymentRowState = {
  id: string;
  paymentMethodId: string;
  amount: string;
  reference: string;
  financialInstitutionId: string | null;
};

const COMMON_CORRECTION_REASONS = [
  "Cliente cambió medio de pago",
  "Pagó con transferencia / QR",
  "Error de digitación en caja",
  "Corrección de franquicia o banco",
  "Pago combinado / dividido",
];

const isCashMethod = (m: PaymentMethod) => {
  const text = `${m.codigo || ""} ${m.nombre || ""}`.toLowerCase();
  return m.tipo === "CASH" || text.includes("efectivo") || text.includes("cash");
};

const getMethodIcon = (codeOrName: string) => {
  const text = (codeOrName || "").toLowerCase();
  if (text.includes("efectivo") || text.includes("cash")) {
    return <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (text.includes("debito") || text.includes("debit")) {
    return <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
  }
  if (text.includes("credito") || text.includes("credit") || text.includes("tarjeta") || text.includes("card")) {
    return <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
  }
  if (text.includes("transfer") || text.includes("banco") || text.includes("bank")) {
    return <Landmark className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
  }
  if (text.includes("qr") || text.includes("breb") || text.includes("bre-b")) {
    return <QrCode className="h-4 w-4 text-teal-600 dark:text-teal-400" />;
  }
  if (text.includes("pse") || text.includes("nequi") || text.includes("daviplata") || text.includes("billetera")) {
    return <Smartphone className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />;
  }
  return <Layers className="h-4 w-4 text-slate-600 dark:text-slate-400" />;
};

export const PreInvoicePaymentStep: React.FC<PreInvoicePaymentStepProps> = ({
  sale,
  activeCashSession,
  onPaymentsUpdated,
  onNext,
  onBack,
  onSavePayments,
  standalone = false,
  onClose,
  autoStartEditing = false,
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [institutions, setInstitutions] = useState<FinancialInstitution[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState<PaymentRowState[]>([]);
  const [amountDisplay, setAmountDisplay] = useState<Record<string, string>>({});
  const [amountFocused, setAmountFocused] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load payment catalogs
  useEffect(() => {
    let active = true;
    Promise.all([
      listPaymentMethods({ active: true }).catch(() => []),
      listFinancialInstitutions().catch(() => []),
    ]).then(([methods, banks]) => {
      if (active) {
        setPaymentMethods(methods.filter((m) => m.active));
        setInstitutions(banks.filter((b) => b.active));
      }
    });
    return () => {
      active = false;
    };
  }, []);

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
    () => institutions.filter((i) => i.active !== false),
    [institutions]
  );

  const hasOpenCashSession = Boolean(activeCashSession && activeCashSession.status === "OPEN");
  const isSameShift = !sale.cashSessionId || !activeCashSession || sale.cashSessionId === activeCashSession.id;
  const canEditPayments = hasOpenCashSession && isSameShift;

  // Initialize edit rows from sale payments
  const handleStartEditing = () => {
    if (!canEditPayments) return;
    setError(null);
    let initialRows: PaymentRowState[] = [];
    if (sale.payments && sale.payments.length > 0) {
      initialRows = sale.payments.map((p, idx) => ({
        id: p.id || `row-${idx}`,
        paymentMethodId:
          p.paymentMethodId ||
          paymentMethods.find(
            (m) =>
              m.nombre.toLowerCase() === (p.paymentMethod ?? "").toLowerCase() ||
              m.codigo.toLowerCase() === (p.paymentMethodCode ?? "").toLowerCase()
          )?.id ||
          paymentMethods[0]?.id ||
          "",
        amount: String(p.amount),
        reference: p.referenceNumber ?? "",
        financialInstitutionId: p.financialInstitutionId ?? null,
      }));
    } else {
      initialRows = [
        {
          id: "row-0",
          paymentMethodId: paymentMethods[0]?.id || "",
          amount: String(sale.total),
          reference: "",
          financialInstitutionId: null,
        },
      ];
    }
    setRows(initialRows);
    const displays: Record<string, string> = {};
    for (const r of initialRows) {
      displays[r.id] = r.amount ? formatPosAmountDisplay(r.amount) : "";
    }
    setAmountDisplay(displays);
    setReason("");
    setIsEditing(true);
  };

  useEffect(() => {
    if (autoStartEditing && canEditPayments && paymentMethods.length > 0 && !isEditing) {
      handleStartEditing();
    }
  }, [autoStartEditing, canEditPayments, paymentMethods.length]);

  const handleCancelEditing = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleRowChange = (idx: number, updates: Partial<PaymentRowState>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...updates } : r))
    );
  };

  const handleAmountChange = (idx: number, id: string, displayValue: string) => {
    setAmountDisplay((prev) => ({ ...prev, [id]: displayValue }));
    const raw = parsePosAmountInput(displayValue);
    handleRowChange(idx, { amount: raw });
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

  // Calculation of totals and difference
  const enteredTotal = useMemo(() => {
    return Number(
      rows
        .reduce((sum, r) => sum + (Number(parsePosAmountInput(r.amount)) || 0), 0)
        .toFixed(2)
    );
  }, [rows]);

  const difference = Number((sale.total - enteredTotal).toFixed(2));
  const isBalanced = Math.abs(difference) <= 0.01;

  const handleAddRow = () => {
    const newId = `row-${Date.now()}`;
    const defaultMethod = paymentMethods.find((m) => !isCashMethod(m)) || paymentMethods[0];
    const remainingDiff = difference > 0 ? String(difference) : "";
    setRows((prev) => [
      ...prev,
      {
        id: newId,
        paymentMethodId: defaultMethod?.id || "",
        amount: remainingDiff,
        reference: "",
        financialInstitutionId: null,
      },
    ]);
    if (remainingDiff) {
      setAmountDisplay((prev) => ({
        ...prev,
        [newId]: formatPosAmountDisplay(remainingDiff),
      }));
    }
  };

  const handleRemoveRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePayments = async () => {
    setError(null);
    if (!reason.trim() || reason.trim().length < 5) {
      setError("El motivo de corrección es obligatorio (mínimo 5 caracteres).");
      return;
    }
    if (!isBalanced) {
      setError(
        `La suma de pagos (${formatCurrency(enteredTotal)}) debe ser igual al total de la venta (${formatCurrency(sale.total)}). Diferencia: ${formatCurrency(difference)}.`
      );
      return;
    }

    setSaving(true);
    try {
      const payload: CorrectOperationalSalePaymentsPayload = {
        reason: reason.trim(),
        payments: rows.map((r) => ({
          paymentMethodId: r.paymentMethodId,
          amount: Number(parsePosAmountInput(r.amount)) || 0,
          reference: r.reference.trim() || null,
          financialInstitutionId: r.financialInstitutionId || null,
        })),
      };
      const updated = await onSavePayments(payload);
      onPaymentsUpdated(updated);
      setIsEditing(false);
      if (standalone && onClose) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la corrección de pagos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {/* Read-Only Payments View */}
      {!isEditing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Medios de pago
              </h4>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Total de la venta: <strong className="font-bold text-slate-900 dark:text-white">{formatCurrency(sale.total)}</strong>
              </span>
            </div>
            {canEditPayments ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleStartEditing}
                className="flex items-center gap-1.5 font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Modificar medios de pago
              </Button>
            ) : !hasOpenCashSession ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                Caja cerrada (solo lectura)
              </span>
            ) : (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                Turno cerrado (solo lectura)
              </span>
            )}
          </div>

          {hasOpenCashSession && !isSameShift ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Esta venta pertenece a un turno anterior. Solo se pueden modificar los medios de pago de ventas realizadas en el turno actual con caja abierta.
            </div>
          ) : null}

          {sale.payments && sale.payments.length > 0 ? (
            <div className="grid gap-2">
              {sale.payments.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      {getMethodIcon(p.paymentMethod ?? "")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {p.paymentMethod ?? "Método de pago"}
                        </p>
                        {p.financialInstitutionNombre ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {p.financialInstitutionNombre}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {p.referenceNumber
                          ? `Ref: ${p.referenceNumber}`
                          : "Sin referencia adicional"}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatCurrency(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              No hay desglose detallado de pagos para esta venta. Pago registrado por el total.
            </div>
          )}
        </div>
      ) : (
        /* Visual POS-like Editing Payments Form - Compact Single-Window Layout */
        <div className="space-y-3 rounded-2xl border border-blue-200 bg-slate-50/50 p-3 sm:p-4 dark:border-blue-900/50 dark:bg-slate-900/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Editar medios de pago
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Selecciona el medio de pago, entidad bancaria y valor recibido
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 text-xs font-semibold shrink-0 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar otro método
            </Button>
          </div>

          <div className="space-y-3">
            {rows.map((row, idx) => {
              const selectedMethod = paymentMethods.find((m) => m.id === row.paymentMethodId);
              const needsInstitution = getRequiresFinancialInstitutionForPos(selectedMethod);
              const needsReference = getRequiresReferenceForPos(selectedMethod);
              const displayAmount =
                amountFocused === row.id
                  ? amountDisplay[row.id] ?? row.amount
                  : amountDisplay[row.id] ??
                    (row.amount ? formatPosAmountDisplay(row.amount) : "");

              return (
                <div
                  key={row.id}
                  className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/50"
                >
                  {/* Row Header (only if multiple rows) */}
                  {rows.length > 1 && (
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Método de pago #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        aria-label={`Eliminar método ${idx + 1}`}
                      >
                        <Trash2 className="h-3 w-3" />
                        Eliminar
                      </button>
                    </div>
                  )}

                  {/* Method Button Grid (compact like POS) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {activeMethods.map((method) => {
                      const isSelected = row.paymentMethodId === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            handleRowChange(idx, {
                              paymentMethodId: method.id,
                              financialInstitutionId: getRequiresFinancialInstitutionForPos(method)
                                ? row.financialInstitutionId
                                : null,
                            });
                          }}
                          className={`flex min-h-[48px] sm:min-h-[50px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-center transition-all ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/90 font-bold text-blue-700 ring-2 ring-blue-600 shadow-xs dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/50"
                          }`}
                        >
                          {getMethodIcon(method.codigo || method.nombre)}
                          <span className="w-full truncate text-[11px] leading-tight font-medium">
                            {method.nombre}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Bank / Wallet Selector if method requires financial institution */}
                  {needsInstitution && (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                      <FinancialInstitutionSelector
                        institutions={activeInstitutions}
                        selectedInstitutionId={row.financialInstitutionId}
                        onSelectInstitution={(instId) =>
                          handleRowChange(idx, { financialInstitutionId: instId })
                        }
                      />
                    </div>
                  )}

                  {/* Value and Reference Inputs */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Valor recibido <span className="text-red-600">*</span>
                      </label>
                      <input
                        inputMode="decimal"
                        value={displayAmount}
                        onFocus={() => handleAmountFocus(row.id, row.amount)}
                        onBlur={() => handleAmountBlur(row.id, row.amount)}
                        onChange={(e) => handleAmountChange(idx, row.id, e.target.value)}
                        placeholder="$ 0"
                        className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Número de referencia {needsReference ? <span className="text-red-600">*</span> : "(Opcional)"}
                      </label>
                      <div className="relative">
                        <input
                          value={row.reference}
                          onChange={(e) => handleRowChange(idx, { reference: e.target.value })}
                          placeholder="Ej. Nro de aprobación / transferencia"
                          className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 pr-8 text-sm font-medium text-slate-900 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        {row.reference ? (
                          <button
                            type="button"
                            onClick={() => handleRowChange(idx, { reference: "" })}
                            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                            aria-label="Limpiar referencia"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compact Single-Window Summary & Reason Strip */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-slate-600 dark:text-slate-400">
                  Total venta: <strong className="font-bold text-slate-900 dark:text-white text-xs">{formatCurrency(sale.total)}</strong>
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Total ingresado: <strong className="font-bold text-slate-900 dark:text-white text-xs">{formatCurrency(enteredTotal)}</strong>
                </span>
              </div>
              {isBalanced ? (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Montos perfectamente cuadrados
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                  Diferencia pendiente: {formatCurrency(difference)}
                </span>
              )}
            </div>

            {/* Quick Reason Pills for easy human operation */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-0.5">
                Motivos frecuentes:
              </span>
              {COMMON_CORRECTION_REASONS.map((r) => {
                const isSelected = reason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                      isSelected
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 shrink-0" />}
                    {r}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Selecciona un motivo arriba o escribe uno personalizado * (auditoría)"
                  className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 pr-8 text-xs text-slate-900 shadow-xs focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                {reason ? (
                  <button
                    type="button"
                    onClick={() => setReason("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
                    title="Borrar motivo"
                    aria-label="Borrar motivo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-2 justify-end shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleCancelEditing}
                  disabled={saving}
                  className="h-[38px] text-xs px-3"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => void handleSavePayments()}
                  disabled={saving || !isBalanced || !reason.trim()}
                  className="h-[38px] text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      {standalone ? (
        <div className="flex justify-end pt-2.5 border-t border-slate-200 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            Cerrar
          </Button>
        </div>
      ) : (
        <div className="flex justify-between pt-2.5 border-t border-slate-200 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onBack}
            disabled={saving || isEditing}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Cliente
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={onNext}
            disabled={saving || isEditing}
            className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
          >
            Continuar a Confirmación
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};
