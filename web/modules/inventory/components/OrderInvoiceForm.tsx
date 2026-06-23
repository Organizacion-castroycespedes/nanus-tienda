"use client";

import { Plus, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { getCurrentPosSession } from "../../../domains/pos/api";
import { usePosContext } from "../../../domains/pos/hooks/usePosContext";
import { useAppSelector } from "../../../store/hooks";
import {
  getCurrentCashSession,
  listPaymentMethods,
} from "../../finance/services/finance.service";
import type { CashSession, PaymentMethod } from "../../finance/types";
import {
  isConfirmCancelledError,
  useConfirm,
} from "../../../hooks/use-confirm";
import {
  getOrderById,
  invoiceOrder,
  type OrderDetailResponse,
} from "../services/order.service";
import { buildConfirmFromApiError } from "../../../lib/api-messages";
import {
  createDefaultCashPayment,
  findCashPaymentMethod,
  parsePaymentAmount,
  rebalanceCashPayment,
} from "../../shared/payments/payment-allocation.helper";

type OrderInvoiceFormProps = {
  orderId: string;
  onCancel: () => void;
  onSuccess: () => void;
};

type PaymentDraft = {
  id: string;
  paymentMethodId: string;
  amount: string;
  referenceNumber: string;
  notes: string;
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

export const OrderInvoiceForm = ({
  orderId,
  onCancel,
  onSuccess,
}: OrderInvoiceFormProps) => {
  const router = useRouter();
  const confirm = useConfirm();
  const tenantId = useAppSelector((state) => state.auth.tenantId ?? state.auth.user?.tenantId);
  const {
    branchId: posBranchId,
    terminalId: posTerminalId,
    posSessionId,
    setSession: setPosSession,
  } = usePosContext();
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [type, setType] = useState<"CASH" | "CREDIT">("CASH");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadOrder = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [result, methods, currentSession, currentPosSession] = await Promise.all([
          getOrderById(orderId),
          listPaymentMethods({ active: true }),
          getCurrentCashSession(),
          getCurrentPosSession().catch(() => null),
        ]);
        if (!mounted) {
          return;
        }

        const activeMethods = methods.filter((method) => method.active);
        if (currentPosSession?.posSessionId) {
          setPosSession({
            posSessionId: currentPosSession.posSessionId,
            branchId: currentPosSession.branchId,
            terminalId: currentPosSession.terminalId,
          });
        }
        setOrder(result);
        setPaymentMethods(activeMethods);
        setCashSession(currentSession);
        setPayments([]);
      } catch {
        if (mounted) {
          setLoadError("No se pudo cargar el detalle del pedido o los metodos de pago.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOrder();

    return () => {
      mounted = false;
    };
  }, [orderId, setPosSession]);

  const rows = useMemo(() => {
    if (!order) {
      return [];
    }

    return order.items
      .map((item) => {
        const invoiceableQuantity = Math.max(item.deliveredQuantity - item.billedQuantity, 0);
        return {
          item,
          invoiceableQuantity,
          subtotal: invoiceableQuantity * item.price,
        };
      })
      .filter((row) => row.invoiceableQuantity > 0);
  }, [order]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.subtotal, 0),
    [rows]
  );

  const inheritedPayments = useMemo(() => {
    const sourcePayments = [...(order?.payments ?? [])];
    let remaining = round(total);

    return sourcePayments
      .map((payment) => {
        const inheritedAmount = round(Math.min(payment.availableAmount, remaining));
        remaining = round(Math.max(remaining - inheritedAmount, 0));

        return {
          ...payment,
          inheritedAmount,
        };
      })
      .filter((payment) => payment.inheritedAmount > 0);
  }, [order?.payments, total]);

  const inheritedTotal = useMemo(
    () => round(inheritedPayments.reduce((sum, payment) => sum + payment.inheritedAmount, 0)),
    [inheritedPayments]
  );

  const paymentMethodById = useMemo(
    () =>
      paymentMethods.reduce<Record<string, PaymentMethod>>((acc, method) => {
        acc[method.id] = method;
        return acc;
      }, {}),
    [paymentMethods]
  );

  const cashPaymentMethod = useMemo(
    () => findCashPaymentMethod(paymentMethods),
    [paymentMethods]
  );

  const parsedPayments = useMemo(
    () =>
      payments.map((payment) => ({
        ...payment,
        numericAmount: parsePaymentAmount(payment.amount),
        method: paymentMethodById[payment.paymentMethodId] ?? null,
      })),
    [paymentMethodById, payments]
  );

  const enteredTotal = useMemo(
    () => round(parsedPayments.reduce((sum, payment) => sum + payment.numericAmount, 0)),
    [parsedPayments]
  );

  const remainingToCover = useMemo(
    () => round(Math.max(total - inheritedTotal, 0)),
    [inheritedTotal, total]
  );

  const resultingBalance = useMemo(
    () => round(Math.max(total - inheritedTotal - enteredTotal, 0)),
    [enteredTotal, inheritedTotal, total]
  );
  const cashSessionMatchesBranch = !cashSession || cashSession.branchId === order?.branchId;
  const hasPosSession = Boolean(posSessionId && posBranchId && posTerminalId);
  const posSessionMatchesBranch =
    !order?.branchId || !posBranchId || posBranchId === order.branchId;
  const contextTarget = `/${tenantId ?? "default"}/pos/select-context`;

  const createInvoicePaymentDraft = useCallback(
    (paymentMethodId: string, amount: string): PaymentDraft => ({
      ...createEmptyDraft(paymentMethodId),
      amount,
    }),
    []
  );

  useEffect(() => {
    if (!order || paymentMethods.length === 0) {
      return;
    }

    if (payments.length === 0) {
      const result = createDefaultCashPayment(
        remainingToCover,
        paymentMethods,
        createInvoicePaymentDraft
      );
      setPayments(result.payments);
      setSubmitError(result.error);
      return;
    }

    const result = rebalanceCashPayment(
      remainingToCover,
      payments,
      cashPaymentMethod,
      createInvoicePaymentDraft
    );
    const changed =
      result.payments.length !== payments.length ||
      result.payments.some((payment, index) => {
        const current = payments[index];
        return (
          !current ||
          payment.paymentMethodId !== current.paymentMethodId ||
          payment.amount !== current.amount ||
          payment.referenceNumber !== current.referenceNumber ||
          payment.notes !== current.notes
        );
      });

    if (changed) {
      setPayments(result.payments);
    }
  }, [
    cashPaymentMethod,
    createInvoicePaymentDraft,
    order,
    paymentMethods,
    payments,
    remainingToCover,
  ]);

  const updatePayment = (id: string, field: keyof PaymentDraft, value: string) => {
    setSubmitError(null);
    setPayments((current) =>
      rebalanceCashPayment(
        remainingToCover,
        current.map((payment) => (payment.id === id ? { ...payment, [field]: value } : payment)),
        cashPaymentMethod,
        createInvoicePaymentDraft
      ).payments
    );
  };

  const addPaymentRow = () => {
    const firstNonCash =
      paymentMethods.find((method) => method.id !== cashPaymentMethod?.id) ??
      paymentMethods[0] ??
      null;
    setPayments((current) =>
      rebalanceCashPayment(
        remainingToCover,
        [...current, createEmptyDraft(firstNonCash?.id ?? "")],
        cashPaymentMethod,
        createInvoicePaymentDraft
      ).payments
    );
  };

  const removePaymentRow = (id: string) => {
    setPayments((current) =>
      rebalanceCashPayment(
        remainingToCover,
        current.filter((payment) => payment.id !== id),
        cashPaymentMethod,
        createInvoicePaymentDraft
      ).payments
    );
  };

  const validate = () => {
    if (rows.length === 0) {
      return "No hay productos entregados pendientes por facturar.";
    }

    if (!hasPosSession) {
      return "Necesitas seleccionar contexto POS y abrir caja antes de facturar este pedido.";
    }

    if (!posSessionMatchesBranch) {
      return "La sesion POS activa pertenece a otra sucursal. Selecciona contexto para la sucursal del pedido.";
    }

    if (
      parsedPayments.some(
        (payment) => payment.numericAmount > 0 && (!payment.paymentMethodId || !payment.method)
      )
    ) {
      return "Selecciona un metodo de pago valido en cada linea con monto.";
    }

    if (parsedPayments.some((payment) => payment.numericAmount < 0)) {
      return "Los montos de pago no pueden ser negativos.";
    }

    if (
      parsedPayments.some(
        (payment) =>
          payment.numericAmount > 0 &&
          payment.method?.requiresReference &&
          payment.referenceNumber.trim() === ""
      )
    ) {
      return "La referencia es obligatoria para los metodos que la requieren.";
    }

    if (!cashSession?.id) {
      return "Debes tener una caja abierta para facturar el pedido.";
    }

    if (
      parsedPayments.some(
        (payment) =>
          payment.numericAmount > 0 &&
          cashSession?.id &&
          cashSession.branchId !== order?.branchId
      )
    ) {
      return "La caja abierta actual pertenece a otra sucursal y no puede usarse para esta factura.";
    }

    if (enteredTotal > remainingToCover) {
      return "Los pagos nuevos no pueden superar el saldo restante tras aplicar los abonos heredados.";
    }

    const duplicateMethods = parsedPayments
      .filter((payment) => payment.numericAmount > 0 && payment.paymentMethodId)
      .map((payment) => payment.paymentMethodId);
    if (new Set(duplicateMethods).size !== duplicateMethods.length) {
      return "No repitas el mismo metodo de pago en varias lineas.";
    }

    if (type === "CASH" && round(enteredTotal) !== round(remainingToCover)) {
      return "Las ventas CASH deben quedar cubiertas totalmente entre abonos heredados y pagos nuevos.";
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

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await confirm({
        title: "Crear venta",
        description:
          "Se crearÃ¡ la venta usando los productos entregados pendientes por facturar y se heredaran los abonos previos de la orden.",
        confirmText: "Crear venta",
        cancelText: "Volver",
        variant: "warning",
      });

      await invoiceOrder(orderId, {
        type,
        payments: parsedPayments
          .filter((payment) => payment.numericAmount > 0)
          .map((payment) => ({
            paymentMethodId: payment.paymentMethodId,
            amount: payment.numericAmount,
            cashSessionId: cashSession?.id ?? undefined,
            referenceNumber: payment.referenceNumber.trim() || undefined,
            notes: payment.notes.trim() || undefined,
          })),
      });
      onSuccess();
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return;
      }
      const apiMessage = error instanceof Error ? error.message : "";
      if (/sesion pos/i.test(apiMessage)) {
        const message =
          "Necesitas seleccionar contexto POS y abrir caja antes de facturar este pedido.";
        setSubmitError(message);
        await confirm({
          title: "Caja requerida",
          description: message,
          confirmText: "Entendido",
          hideCancel: true,
          variant: "warning",
        });
        return;
      }
      const dialog = buildConfirmFromApiError(
        error,
        "No se pudo crear la venta desde la orden."
      );
      setSubmitError(dialog.description ?? "No se pudo crear la venta desde la orden.");
      await confirm({
        ...dialog,
        confirmText: "Entendido",
        hideCancel: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Orders</p>
          <h2 className="text-xl font-semibold text-slate-900">Facturar orden</h2>
          <p className="mt-2 text-sm text-slate-600">
            Crea una venta usando solo los productos entregados y no facturados.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Cargando detalle del pedido...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : order ? (
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Cliente</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {order.customerName || order.customerId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Sucursal</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {order.branchName || order.branchId || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{order.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Terminal</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {order.terminalName || "-"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Entregado</th>
                    <th className="px-4 py-3 font-medium">Facturado</th>
                    <th className="px-4 py-3 font-medium">Facturar ahora</th>
                    <th className="px-4 py-3 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        No hay productos entregados pendientes por facturar.
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ item, invoiceableQuantity, subtotal }) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-slate-900">
                          {item.productName || item.productId}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.deliveredQuantity}</td>
                        <td className="px-4 py-3 text-slate-700">{item.billedQuantity}</td>
                        <td className="px-4 py-3 text-slate-700">{invoiceableQuantity}</td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(subtotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Select
              label="Tipo de venta"
              value={type}
              onChange={(event) => setType(event.target.value as "CASH" | "CREDIT")}
            >
              <option value="CASH">CASH</option>
              <option value="CREDIT">CREDIT</option>
            </Select>
            <Input
              label="Saldo por cubrir con pagos nuevos"
              value={formatCurrency(remainingToCover)}
              disabled
              readOnly
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Wallet className="h-4 w-4" />
              Caja y abonos heredados
            </div>
            {!hasPosSession ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">Selecciona contexto POS antes de facturar.</p>
                <p className="mt-1">
                  La factura crea una venta y necesita sesion POS valida en la sucursal del pedido.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push(contextTarget)}
                >
                  Ir a seleccion de contexto
                </Button>
              </div>
            ) : !posSessionMatchesBranch ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">La sesion POS activa no coincide con la sucursal.</p>
                <p className="mt-1">
                  Cambia el contexto POS a la sucursal del pedido antes de facturar.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push(contextTarget)}
                >
                  Cambiar contexto
                </Button>
              </div>
            ) : null}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              {cashSession
                ? `${cashSession.cashRegisterNombre ?? "Caja"} abierta con fondo ${formatCurrency(
                    cashSession.openingAmount
                  )}.`
                : "No hay una caja abierta para este usuario. Los pagos nuevos en efectivo quedaran bloqueados."}
              {cashSession && !cashSessionMatchesBranch ? (
                <p className="mt-2 text-amber-700">
                  La caja abierta actual pertenece a otra sucursal. Si agregas pagos nuevos en
                  efectivo, la operacion sera bloqueada.
                </p>
              ) : null}
            </div>
            {inheritedPayments.length === 0 ? (
              <p className="text-sm text-slate-600">
                Esta orden no tiene abonos pendientes para heredar a la factura.
              </p>
            ) : (
              <div className="space-y-3">
                {inheritedPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Metodo</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {payment.paymentMethodNombre ?? payment.paymentMethodId}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Abono orden</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {formatCurrency(payment.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Disponible para factura
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {formatCurrency(payment.availableAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-emerald-700">
                          Se aplicara ahora
                        </p>
                        <p className="mt-1 text-sm font-semibold text-emerald-950">
                          {formatCurrency(payment.inheritedAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Pagos nuevos</h3>
                <p className="text-sm text-slate-600">
                  Puedes registrar varios medios de pago adicionales al momento de facturar.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addPaymentRow}>
                <Plus className="h-4 w-4" />
                Agregar pago
              </Button>
            </div>

            {payments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                No has agregado pagos nuevos para esta factura.
              </div>
            ) : (
              payments.map((payment, index) => {
                const method = paymentMethodById[payment.paymentMethodId];

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
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <Select
                        label="Metodo de pago"
                        value={payment.paymentMethodId}
                        onChange={(event) =>
                          updatePayment(payment.id, "paymentMethodId", event.target.value)
                        }
                      >
                        <option value="">Selecciona un metodo</option>
                        {paymentMethods.map((methodOption) => (
                          <option key={methodOption.id} value={methodOption.id}>
                            {methodOption.nombre}
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
                        onChange={(event) => updatePayment(payment.id, "notes", event.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">
                  Total a facturar
                </p>
                <p className="text-sm text-emerald-900/80">
                  Solo se incluyen cantidades entregadas y pendientes por facturar.
                </p>
              </div>
              <p className="text-xl font-semibold text-emerald-950">{formatCurrency(total)}</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">
                  Abonos heredados
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-950">
                  {formatCurrency(inheritedTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">
                  Pagos nuevos
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-950">
                  {formatCurrency(enteredTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">
                  Saldo resultante
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-950">
                  {formatCurrency(resultingBalance)}
                </p>
              </div>
            </div>
          </section>

          {submitError ? (
            <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p>{submitError}</p>
              {submitError.toLowerCase().includes("pos") ||
              submitError.toLowerCase().includes("sucursal") ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(contextTarget)}
                >
                  Ir a seleccion de contexto
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={isSubmitting} disabled={rows.length === 0}>
              Crear venta
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
};
