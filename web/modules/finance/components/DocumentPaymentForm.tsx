"use client";

import { Plus, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import {
  createPayment,
  getCurrentCashSession,
  listPaymentMethods,
} from "../services/finance.service";
import type {
  CashSession,
  CreatePaymentPayload,
  FinancePaymentStatus,
  PaymentDirection,
  PaymentMethod,
  PaymentReferenceType,
} from "../types";

type PaymentDraft = {
  id: string;
  paymentMethodId: string;
  amount: string;
  referenceNumber: string;
  notes: string;
};

type DocumentPaymentFormProps = {
  title: string;
  description: string;
  branchId: string;
  referenceType: PaymentReferenceType;
  referenceId: string;
  direction: PaymentDirection;
  total: number;
  totalPaid: number;
  balanceDue: number;
  paymentStatus: FinancePaymentStatus;
  onCancel: () => void;
  onSuccess: () => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const round = (value: number) => Number(value.toFixed(2));

const buildDraftId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyDraft = (paymentMethodId = ""): PaymentDraft => ({
  id: buildDraftId(),
  paymentMethodId,
  amount: "",
  referenceNumber: "",
  notes: "",
});

const parseAmount = (value: string) => {
  const sanitized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? round(parsed) : 0;
};

export const DocumentPaymentForm = ({
  title,
  description,
  branchId,
  referenceType,
  referenceId,
  direction,
  total,
  totalPaid,
  balanceDue,
  paymentStatus,
  onCancel,
  onSuccess,
}: DocumentPaymentFormProps) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [payments, setPayments] = useState<PaymentDraft[]>([createEmptyDraft()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [methods, currentSession] = await Promise.all([
          listPaymentMethods({ active: true }),
          getCurrentCashSession(),
        ]);

        if (!active) {
          return;
        }

        const activeMethods = methods.filter((method) => method.active);
        setPaymentMethods(activeMethods);
        setCashSession(currentSession);
        setPayments((current) =>
          current.map((payment, index) =>
            index === 0 && !payment.paymentMethodId
              ? { ...payment, paymentMethodId: activeMethods[0]?.id ?? "" }
              : payment
          )
        );
      } catch {
        if (active) {
          setLoadError("No se pudieron cargar los metodos de pago o la caja actual.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const methodById = useMemo(
    () =>
      paymentMethods.reduce<Record<string, PaymentMethod>>((acc, method) => {
        acc[method.id] = method;
        return acc;
      }, {}),
    [paymentMethods]
  );

  const parsedPayments = useMemo(
    () =>
      payments.map((payment) => ({
        ...payment,
        numericAmount: parseAmount(payment.amount),
        method: methodById[payment.paymentMethodId] ?? null,
      })),
    [methodById, payments]
  );

  const enteredTotal = useMemo(
    () => round(parsedPayments.reduce((sum, payment) => sum + payment.numericAmount, 0)),
    [parsedPayments]
  );

  const remainingBalance = useMemo(
    () => round(Math.max(balanceDue - enteredTotal, 0)),
    [balanceDue, enteredTotal]
  );

  const isFullyPaid = paymentStatus === "PAID" || paymentStatus === "OVERPAID";

  const updatePayment = (id: string, field: keyof PaymentDraft, value: string) => {
    setSubmitError(null);
    setPayments((current) =>
      current.map((payment) => (payment.id === id ? { ...payment, [field]: value } : payment))
    );
  };

  const addPaymentRow = () => {
    setPayments((current) => [
      ...current,
      createEmptyDraft(paymentMethods[0]?.id ?? ""),
    ]);
  };

  const removePaymentRow = (id: string) => {
    setPayments((current) =>
      current.length === 1 ? current : current.filter((payment) => payment.id !== id)
    );
  };

  const validate = () => {
    if (!branchId) {
      return "No se encontro la sucursal del documento.";
    }
    if (isFullyPaid || balanceDue <= 0) {
      return "El documento ya no tiene saldo pendiente.";
    }
    if (parsedPayments.length === 0) {
      return "Debes registrar al menos una linea de pago.";
    }
    if (parsedPayments.some((payment) => !payment.paymentMethodId || !payment.method)) {
      return "Selecciona un metodo de pago valido en cada linea.";
    }
    if (parsedPayments.some((payment) => payment.numericAmount <= 0)) {
      return "Todos los pagos deben tener un monto mayor a cero.";
    }
    if (
      parsedPayments.some(
        (payment) =>
          payment.method?.requiresReference &&
          payment.referenceNumber.trim().length === 0
      )
    ) {
      return "Los metodos que exigen referencia deben llevar numero de referencia.";
    }
    if (
      parsedPayments.some(
        (payment) => payment.method?.tipo === "CASH" && !cashSession?.id
      )
    ) {
      return "Necesitas una caja abierta para registrar pagos en efectivo.";
    }
    if (enteredTotal > balanceDue) {
      return "El total ingresado no puede superar el saldo pendiente del documento.";
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      for (const payment of parsedPayments) {
        const payload: CreatePaymentPayload = {
          branchId,
          paymentMethodId: payment.paymentMethodId,
          cashSessionId: payment.method?.tipo === "CASH" ? cashSession?.id ?? undefined : undefined,
          referenceType,
          referenceId,
          direction,
          status: "COMPLETED",
          amount: payment.numericAmount,
          referenceNumber: payment.referenceNumber.trim() || undefined,
          notes: payment.notes.trim() || undefined,
          allocations: [
            {
              referenceType,
              referenceId,
              allocatedAmount: payment.numericAmount,
            },
          ],
        };

        await createPayment(payload);
      }

      onSuccess();
    } catch {
      setSubmitError("No se pudo registrar el pago.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Finance</p>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Cargando configuracion de pagos...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : (
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(total)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pagado</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatCurrency(totalPaid)}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-amber-700">Saldo pendiente</p>
              <p className="mt-1 text-sm font-semibold text-amber-950">
                {formatCurrency(balanceDue)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{paymentStatus}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Wallet className="h-4 w-4" />
              Caja actual
            </div>
            <p className="text-sm text-slate-600">
              {cashSession
                ? `${cashSession.cashRegisterNombre ?? "Caja"} abierta con fondo ${formatCurrency(
                    cashSession.openingAmount
                  )}.`
                : "No hay una caja abierta para este usuario. Los pagos en efectivo quedaran bloqueados."}
            </p>
          </section>

          <section className="space-y-3">
            {payments.map((payment, index) => {
              const method = methodById[payment.paymentMethodId];

              return (
                <div
                  key={payment.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Pago #{index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePaymentRow(payment.id)}
                      className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      disabled={payments.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Select
                      label="Metodo"
                      value={payment.paymentMethodId}
                      onChange={(event) =>
                        updatePayment(payment.id, "paymentMethodId", event.target.value)
                      }
                    >
                      <option value="">Selecciona un metodo</option>
                      {paymentMethods.map((paymentMethod) => (
                        <option key={paymentMethod.id} value={paymentMethod.id}>
                          {paymentMethod.nombre}
                        </option>
                      ))}
                    </Select>

                    <Input
                      label="Monto"
                      inputMode="decimal"
                      value={payment.amount}
                      onChange={(event) =>
                        updatePayment(payment.id, "amount", event.target.value)
                      }
                      placeholder="0"
                    />

                    <Input
                      label={method?.requiresReference ? "Referencia obligatoria" : "Referencia"}
                      value={payment.referenceNumber}
                      onChange={(event) =>
                        updatePayment(payment.id, "referenceNumber", event.target.value)
                      }
                      placeholder="Numero o comprobante"
                    />

                    <Input
                      label="Notas"
                      value={payment.notes}
                      onChange={(event) =>
                        updatePayment(payment.id, "notes", event.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              );
            })}

            <Button type="button" variant="outline" onClick={addPaymentRow}>
              <Plus className="h-4 w-4" />
              Agregar linea de pago
            </Button>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-emerald-900/80">Registrado en esta operacion</span>
              <span className="font-semibold text-emerald-950">
                {formatCurrency(enteredTotal)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-emerald-900/80">Saldo restante despues del abono</span>
              <span className="font-semibold text-emerald-950">
                {formatCurrency(remainingBalance)}
              </span>
            </div>
          </section>

          {submitError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={submitting} disabled={isFullyPaid || balanceDue <= 0}>
              Registrar pago
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
};
